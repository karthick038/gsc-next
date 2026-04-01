import connectDB from "@/lib/db";
import Settings from "@/models/Settings";
import SitemapBatchQueue from "@/models/SitemapBatchQueue";
import SitemapLog from "@/models/SitemapLog";
import User from "@/models/User";
import Sitemap from "@/models/Sitemap";
import ServiceAccount from "@/models/ServiceAccount";
import { performSitemapBatchDispatch } from "@/lib/mailer-v2";

/**
 * Calculates the Friday 6:00 PM IST (12:30 PM UTC) that is at least 14 days after the startDate.
 */
export function calculate14DayFridayWindow(startDate = new Date()) {
    const target = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    const day = target.getUTCDay();
    const diff = (5 - day + 7) % 7;
    
    const friday = new Date(target);
    friday.setUTCDate(target.getUTCDate() + diff);
    friday.setUTCHours(12, 30, 0, 0);
    
    if (friday < target) {
        friday.setUTCDate(friday.getUTCDate() + 7);
    }
    return friday;
}

/**
 * Triggers the dispatch of a sitemap batch report.
 * Can be called manually or automatically by the background worker.
 */
export async function sendBatchDispatch(adminEmail = null, skipLockCheck = false) {
    try {
        await connectDB();

        // 1. Guard: skip if already processing (unless called from the trusted mutex)
        const settings = await Settings.findOne({});
        if (!skipLockCheck && settings?.sitemapIsProcessing) {
            console.log("[BATCH-SERVICE] Skipping: Dispatch already in progress.");
            return { success: false, error: "Processing already in progress." };
        }

        // 2. Fetch Queue — use .lean() to get plain JS objects (not Mongoose docs)
        const queuedItems = await SitemapBatchQueue
            .find({ status: "queued" })
            .sort({ submittedAt: 1 })
            .lean();

        if (!queuedItems.length) {
            console.log("[BATCH-SERVICE] Queue is empty. Resetting scheduler state.");
            await Settings.findOneAndUpdate({}, {
                $set: { sitemapNextRunDate: null, sitemapIsProcessing: false }
            });
            return { success: false, error: "Queue is empty. Nothing to send." };
        }

        // Normalize health status on every item before emailing
        // Ensures any item with errorCount > 0 is always treated as ERROR
        const normalizedItems = queuedItems.map(item => ({
            ...item,
            healthStatus: (item.healthStatus === "ERROR" || (item.errorCount > 0))
                ? "ERROR"
                : "SUCCESS"
        }));

        // 3. Group items by userEmail — each user gets their own consolidated report
        const groups = {};
        normalizedItems.forEach(item => {
            // Note: userEmail in the queue might be the GSC account email or user login email
            const key = item.userEmail || "UNKNOWN";
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        // 4. Set lock for processing
        if (!skipLockCheck) {
            await Settings.findOneAndUpdate({}, { $set: { sitemapIsProcessing: true } });
        }

        const dispatchSummary = [];
        const processedIds = [];

        // 5. Process each group
        for (const [userEmail, items] of Object.entries(groups)) {
            let finalRecipient = null;
            let resolutionPath = "NONE";

            // RESOLVE SERVICE ACCOUNT EMAIL:
            // High Priority: Try to find a Service Account override for the owning user
            // We only trust the userEmail from the queue if it's NOT a service account address
            const isServiceAccountEmail = userEmail && userEmail.includes("gserviceaccount.com");
            
            if (userEmail && userEmail !== "UNKNOWN" && !isServiceAccountEmail) {
                try {
                    const primaryEmail = userEmail.split(",")[0].trim();
                    const user = await User.findOne({
                        $or: [
                            { email: primaryEmail },
                            { "verifiedSites.accountEmail": primaryEmail }
                        ]
                    });

                    if (user) {
                        const sa = await ServiceAccount.findOne({ userId: user._id });
                        const saEmail = sa?.userEmail || sa?.clientEmail;

                        if (saEmail && !saEmail.includes("gserviceaccount.com")) {
                            finalRecipient = saEmail;
                            resolutionPath = "SERVICE_ACCOUNT_CONFIG";
                        } else {
                            // No valid personal SA email, use the email from the queue
                            // But skip if it's a SA email
                            if (userEmail && !userEmail.includes("gserviceaccount.com")) {
                                finalRecipient = userEmail;
                                resolutionPath = "QUEUE_USER_EMAIL";
                            }
                        }
                    } else {
                        // No user found, stick with the queue email for now (if not a SA address)
                        if (userEmail && !userEmail.includes("gserviceaccount.com")) {
                            finalRecipient = userEmail;
                            resolutionPath = "QUEUE_FALLBACK";
                        }
                    }
                } catch (err) {
                    console.error(`[BATCH-SERVICE] resolution error for ${userEmail}:`, err.message);
                    finalRecipient = userEmail;
                }
            }

            // SITE-BASED RECOVERY: 
            // If recipient is still unknown, try identifying owner via the sitemap URL itself
            if (!finalRecipient || finalRecipient === "UNKNOWN") {
                try {
                    const sampleItem = items[0];
                    if (sampleItem?.sitemapUrl) {
                        const dbSitemap = await Sitemap.findOne({ feedpath: sampleItem.sitemapUrl });
                        if (dbSitemap) {
                            // Search verified sites across ALL users to find the owner
                            // Normalized comparison for safety
                            const normalizedUrl = dbSitemap.siteUrl.toLowerCase().replace(/\/$/, "");
                            const owner = await User.findOne({ 
                                "verifiedSites.url": { $regex: new RegExp("^" + normalizedUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/?$", "i") }
                            });

                            if (owner) {
                                const sa = await ServiceAccount.findOne({ userId: owner._id });
                                const saEmail = sa?.userEmail || sa?.clientEmail;

                                if (saEmail && !saEmail.includes("gserviceaccount.com")) {
                                    finalRecipient = saEmail;
                                    resolutionPath = "SITE_OWNER_SA_RECOVERY";
                                } else {
                                    finalRecipient = owner.email;
                                    resolutionPath = "SITE_OWNER_LOGIN_RECOVERY";
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error("[BATCH-SERVICE] Site recovery error:", err.message);
                }
            }

            // GLOBAL FALLBACK:
            // Only use the 'Email Configuration' receipt field if we have absolutely no recipient yet
            if (!finalRecipient || finalRecipient === "UNKNOWN") {
                finalRecipient = settings?.notificationEmail || adminEmail;
                resolutionPath = "GLOBAL_SETTINGS_FALLBACK";
            }

            if (!finalRecipient) {
                console.warn(`[BATCH-SERVICE] Skipping group ${userEmail}: No recipient found at any level.`);
                continue;
            }

            console.log(`[BATCH-SERVICE] Dispatching via [${resolutionPath}] to: ${finalRecipient} (${items.length} items)`);

            try {
                const result = await performSitemapBatchDispatch({
                    to: finalRecipient,
                    submissions: items
                });

                if (result.success) {
                    dispatchSummary.push(`${items.length} items -> ${finalRecipient}`);
                    processedIds.push(...items.map(i => i._id));
                } else {
                    console.error(`[BATCH-SERVICE] Failed for recipient ${finalRecipient}:`, result.error);
                }
            } catch (err) {
                console.error(`[BATCH-SERVICE] Fatal error sending to ${finalRecipient}:`, err.message);
            }
        }

        if (processedIds.length === 0) {
            await Settings.findOneAndUpdate({}, { $set: { sitemapIsProcessing: false } });
            return { success: false, error: "No reports were successfully sent." };
        }

        // 6. Success: mark items as sent and clear schedule
        try {
            await SitemapBatchQueue.updateMany(
                { _id: { $in: processedIds } },
                { $set: { status: "sent" } }
            );

            // Only reschedule if there are still items in the queue (e.g. failures or new additions)
            const remainingCount = await SitemapBatchQueue.countDocuments({ status: "queued" });
            
            await Settings.findOneAndUpdate({}, {
                $set: {
                    sitemapLastRunDate: new Date(),
                    sitemapNextRunDate: remainingCount > 0 ? calculate14DayFridayWindow(new Date()) : null,
                    sitemapIsProcessing: false
                }
            });

            const successMsg = `Batch complete. Reports sent: ${dispatchSummary.join(" | ")}`;
            console.log(`[BATCH-SERVICE] ✓ ${successMsg}`);
            
            await SitemapLog.create({
                status: "SUCCESS",
                message: successMsg,
                itemCount: processedIds.length
            });

            return { success: true, summary: successMsg, sentAt: new Date() };

        } catch (updateErr) {
            console.error("[BATCH-SERVICE] Post-dispatch DB error:", updateErr.message);
            throw updateErr;
        } finally {
            // Always release the lock
            await Settings.findOneAndUpdate(
                { sitemapIsProcessing: true },
                { $set: { sitemapIsProcessing: false } }
            );
        }

    } catch (error) {
        console.error("[BATCH-SERVICE] Fatal error:", error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Scheduled check called by the background heartbeat (instrumentation.js)
 * and by passive triggers (admin page visits).
 *
 * Uses an atomic MongoDB mutex so only one process can dispatch at any time,
 * even if called concurrently from multiple sources.
 */
export async function checkAndDispatchSitemapBatch(callerLabel = "UNKNOWN") {
    try {
        await connectDB();

        // --- STALE LOCK RECOVERY ---
        // If sitemapIsProcessing has been true for 2+ minutes past the target time,
        // assume a crash occurred and force-release the lock.
        const settingsCheck = await Settings.findOne({});
        if (settingsCheck?.sitemapIsProcessing && settingsCheck?.sitemapNextRunDate) {
            const twoMinsPast = new Date(settingsCheck.sitemapNextRunDate.getTime() + 2 * 60 * 1000);
            if (new Date() > twoMinsPast) {
                console.log("[LAZY-SCHEDULER] Stale lock detected (2+ mins). Force-releasing...");
                await SitemapLog.create({ status: "INFO", message: "Stale processing lock force-released." });
                await Settings.findOneAndUpdate({}, { $set: { sitemapIsProcessing: false } });
            }
        }

        // --- ATOMIC MUTEX LOCK ---
        // findOneAndUpdate is atomic: exactly ONE caller wins this race condition.
        const lockResult = await Settings.findOneAndUpdate(
            {
                sitemapBatchingEnabled: true,
                sitemapIsProcessing: false,
                sitemapNextRunDate: { $lte: new Date(), $ne: null }
            },
            { $set: { sitemapIsProcessing: true } },
            { new: true }
        );

        if (!lockResult) {
            // Time hasn't arrived yet, or another process already holds the lock
            return null;
        }

        // Lock acquired — we are the sole process running the dispatch
        console.log(`[LAZY-SCHEDULER] ✓ Lock acquired by [${callerLabel}]. Running dispatch...`);
        await SitemapLog.create({
            status: "INFO",
            message: `Automated dispatch triggered by [${callerLabel}]`
        });

        const recipientEmail = lockResult.notificationEmail || lockResult.senderEmail;

        try {
            // skipLockCheck=true because the mutex above already secured exclusive access
            return await sendBatchDispatch(recipientEmail, true);
        } finally {
            // Guarantee lock release even if sendBatchDispatch throws unexpectedly
            await Settings.findOneAndUpdate(
                { sitemapIsProcessing: true },
                { $set: { sitemapIsProcessing: false } }
            );
        }

    } catch (error) {
        console.error("[LAZY-SCHEDULER] Error:", error.message);
        // Attempt emergency lock release
        try {
            await Settings.findOneAndUpdate(
                { sitemapIsProcessing: true },
                { $set: { sitemapIsProcessing: false } }
            );
        } catch (_) { /* ignore */ }
    }

    // --- SELF-HEALING ---
    // If items exist in the queue but no schedule is set, create the 14-day window.
    try {
        const settings = await Settings.findOne({});
        if (settings && !settings.sitemapNextRunDate && !settings.sitemapIsProcessing) {
            const queueCount = await SitemapBatchQueue.countDocuments({ status: "queued" });
            if (queueCount > 0) {
                const nextRun = calculate14DayFridayWindow(new Date());
                await Settings.findOneAndUpdate({}, { $set: { sitemapNextRunDate: nextRun } });
                console.log(`[LAZY-SCHEDULER] Self-healed: ${queueCount} orphaned items found. Next run (14d Friday): ${nextRun.toLocaleString()}`);
                await SitemapLog.create({
                    status: "INFO",
                    message: `Self-heal: ${queueCount} queued items found. Bi-weekly Friday schedule initialized.`,
                    itemCount: queueCount
                });
            }
        }
    } catch (healError) {
        console.error("[LAZY-SCHEDULER] Self-heal error:", healError.message);
    }

    return null;
}
