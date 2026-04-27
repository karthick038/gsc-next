import connectDB from "@/lib/db";
import Settings from "@/models/Settings";
import SitemapBatchQueue from "@/models/SitemapBatchQueue";
import SitemapLog from "@/models/SitemapLog";
import User from "@/models/User";
import Sitemap from "@/models/Sitemap";
import ServiceAccount from "@/models/ServiceAccount";
import { performSitemapBatchDispatch, sendHealthCheckEmail } from "@/lib/mailer-v2";
import { performHealthCheck } from "@/lib/health-check-service";
import { google } from "googleapis";
import { decrypt } from "@/lib/encryption";
import HealthCheckLog from "@/models/HealthCheckLog";

/**
 * Calculates the Next Run date based on user configuration.
 * Formula: 
 * If Now < StartDateTime, First Run = StartDateTime.
 * If Now >= StartDateTime, Next Run = StartDateTime + N * IntervalDays, where N makes NextRun > Now.
 */
/**
 * Calculates the Next Run date based on user configuration.
 * Prefix can be 'sitemap' or 'reporting'.
 */
export function calculateNextDynamicRun(settings, prefix = "sitemap") {
    const now = new Date();
    const intervalField = `${prefix}Interval`;
    const refTimeField = `${prefix}ReferenceTime`;
    
    const interval = settings?.[intervalField] || "14_DAYS";
    
    // 1. Minute-based interval (e.g., 5 Minutes)
    if (interval === "5_MINS") {
        return new Date(now.getTime() + 5 * 60 * 1000);
    }
    
    const refTime = settings?.[refTimeField] || "00:00"; // HH:mm format
    const [hours, minutes] = refTime.split(":").map(Number);
    const nextRun = new Date();

    // 2. Specialized Friday-only schedules
    if (interval === "7_DAYS" || interval === "14_DAYS") {
        const currentDay = nextRun.getDay(); // 0-6 (Sun-Sat), Fri = 5
        let daysUntilFriday = (5 - currentDay + 7) % 7;
        
        const testRun = new Date(nextRun);
        testRun.setDate(testRun.getDate() + daysUntilFriday);
        testRun.setHours(hours, minutes, 0, 0);
        
        // If today is Friday but the target time has passed, jump to the NEXT Friday
        if (daysUntilFriday === 0 && testRun <= now) {
            daysUntilFriday = 7;
        }
        
        nextRun.setDate(nextRun.getDate() + daysUntilFriday);
        
        // For 14 days, add an extra 7 days so it skips perfectly into bi-weekly gaps from the anchored Friday
        if (interval === "14_DAYS") {
            nextRun.setDate(nextRun.getDate() + 7);
        }
        
        nextRun.setHours(hours, minutes, 0, 0);
        return nextRun;
    }
    
    // 3. Day-based interval (1 DAY)
    let intervalDays = 1; // Default fallback
    if (interval === "1_DAY") intervalDays = 1;

    nextRun.setDate(nextRun.getDate() + intervalDays);
    nextRun.setHours(hours, minutes, 0, 0);
    
    // If calculated nextRun is somehow in the past, push forward by interval
    if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + intervalDays);
    }
    
    return nextRun;
}

/**
 * Triggers the dispatch of a sitemap batch report.
 * Can be called manually or automatically by the background worker.
 */
export async function sendBatchDispatch(adminEmail = null, skipLockCheck = false, triggerSource = "Manual") {
    try {
        await connectDB();

        // 1. Guard: skip if already processing (unless called from the trusted mutex)
        const settings = await Settings.findOne({});
        if (!skipLockCheck && settings?.reportingIsProcessing) {
            console.log("[BATCH-SERVICE] Skipping: Dispatch already in progress.");
            return { success: false, error: "Processing already in progress." };
        }

        // 2. Fetch Queue — use .lean() to get plain JS objects (not Mongoose docs)
        const queuedItems = await SitemapBatchQueue
            .find({ status: "queued" })
            .sort({ submittedAt: 1 })
            .lean();

        if (!queuedItems.length) {
            console.log("[BATCH-SERVICE] Queue is empty. Resetting reporting state.");
            await Settings.findOneAndUpdate({}, {
                $set: { reportingNextRunDate: null, reportingIsProcessing: false }
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
            await Settings.findOneAndUpdate({}, { $set: { reportingIsProcessing: true } });
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
            await SitemapLog.create({
                status: "ERROR",
                logCategory: "reporting",
                message: `Reporting dispatch failed — no emails sent.`,
                details: `Trigger: ${triggerSource} | Recipients attempted: ${Object.keys(groups).join(", ") || "none"}`
            });
            await Settings.findOneAndUpdate({}, { $set: { reportingIsProcessing: false } });
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
                    reportingLastRunDate: new Date(),
                    reportingNextRunDate: remainingCount > 0 ? calculateNextDynamicRun(settings, "reporting") : null,
                    reportingIsProcessing: false
                }
            });

            const successMsg = `Reporting dispatch complete — ${processedIds.length} item(s) sent via ${triggerSource}.`;
            console.log(`[BATCH-SERVICE] ✓ ${successMsg}`);
            
            await SitemapLog.create({
                status: "SUCCESS",
                logCategory: "reporting",
                message: successMsg,
                itemCount: processedIds.length,
                details: `Trigger: ${triggerSource} | Dispatched to: ${dispatchSummary.join(" | ")}`,
                items: normalizedItems.map(item => {
                    let errorMsg = "Passed";
                    if (item.healthStatus !== "SUCCESS") {
                        const lastLog = item.errorLogs?.[item.errorLogs.length - 1];
                        errorMsg = lastLog?.message || lastLog?.type || "Failed with issues";
                    }
                    return {
                        sitemapUrl: item.sitemapUrl,
                        healthStatus: item.healthStatus,
                        errorCount: item.errorCount,
                        message: errorMsg
                    };
                })
            });

            return { success: true, summary: successMsg, sentAt: new Date() };

        } catch (updateErr) {
            console.error("[BATCH-SERVICE] Post-dispatch DB error:", updateErr.message);
            throw updateErr;
        } finally {
            // Always release the lock
            await Settings.findOneAndUpdate(
                { reportingIsProcessing: true },
                { $set: { reportingIsProcessing: false } }
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
        // If reportingIsProcessing has been true for 2+ minutes past the target time,
        // assume a crash occurred and force-release the lock.
        const settingsCheck = await Settings.findOne({});
        if (settingsCheck?.reportingIsProcessing && settingsCheck?.reportingNextRunDate) {
            const twoMinsPast = new Date(settingsCheck.reportingNextRunDate.getTime() + 2 * 60 * 1000);
            if (new Date() > twoMinsPast) {
                console.log("[LAZY-SCHEDULER] Stale Reporting lock detected (2+ mins). Force-releasing...");
                await SitemapLog.create({ status: "INFO", logCategory: "reporting", message: "Stale reporting lock force-released." });
                await Settings.findOneAndUpdate({}, { $set: { reportingIsProcessing: false } });
            }
        }

        // --- ATOMIC MUTEX LOCK ---
        // findOneAndUpdate is atomic: exactly ONE caller wins this race condition.
        const lockResult = await Settings.findOneAndUpdate(
            {
                reportingEnabled: true,
                reportingIsProcessing: false,
                reportingNextRunDate: { $lte: new Date(), $ne: null }
            },
            { $set: { reportingIsProcessing: true } },
            { new: true }
        );

        if (!lockResult) {
            // Time hasn't arrived yet, or another process already holds the lock
            return null;
        }

        // Lock acquired — log the start with full context
        console.log(`[LAZY-SCHEDULER] ✓ Reporting Lock acquired by [${callerLabel}]. Running processing...`);
        const queuedCount = await SitemapBatchQueue.countDocuments({ status: "queued" });
        await SitemapLog.create({
            status: "INFO",
            logCategory: "reporting",
            message: `Scheduled reporting run triggered.`,
            itemCount: queuedCount,
            details: `Trigger: Scheduled Run | Caller: ${callerLabel} | Items in queue: ${queuedCount} | Recipient: ${lockResult.notificationEmail || lockResult.senderEmail || "not configured"}`
        });

        const recipientEmail = lockResult.notificationEmail || lockResult.senderEmail;

        try {
            // skipLockCheck=true because the mutex above already secured exclusive access
            return await sendBatchDispatch(recipientEmail, true, "Scheduled Run");
        } finally {
            // Guarantee lock release even if sendBatchDispatch throws unexpectedly
            await Settings.findOneAndUpdate(
                { reportingIsProcessing: true },
                { $set: { reportingIsProcessing: false } }
            );
        }

    } catch (error) {
        console.error("[LAZY-SCHEDULER] Reporting Error:", error.message);
        // Attempt emergency lock release
        try {
            await Settings.findOneAndUpdate(
                { reportingIsProcessing: true },
                { $set: { reportingIsProcessing: false } }
            );
        } catch (_) { /* ignore */ }
    }

    // --- SELF-HEALING ---
    // If items exist in the queue but no schedule is set, create the reporting window.
    try {
        const settings = await Settings.findOne({});
        if (settings && !settings.reportingNextRunDate && !settings.reportingIsProcessing) {
            const queueCount = await SitemapBatchQueue.countDocuments({ status: "queued" });
            if (queueCount > 0) {
                const nextRun = calculateNextDynamicRun(settings, "reporting");
                await Settings.findOneAndUpdate({}, { $set: { reportingNextRunDate: nextRun } });
                console.log(`[LAZY-SCHEDULER] Reporting Self-healed: ${queueCount} orphaned items found. Next run (Dynamic): ${nextRun.toLocaleString()}`);
                await SitemapLog.create({
                    status: "INFO",
                    logCategory: "reporting",
                    message: `Reporting Self-heal: ${queueCount} queued items found. Dynamic schedule initialized.`,
                    itemCount: queueCount
                });
            }
        }
    } catch (healError) {
        console.error("[LAZY-SCHEDULER] Reporting Self-heal error:", healError.message);
    }

    return null;
}

/**
 * POST-AUTOMATION REPORTING TRIGGER
 * Runs 5 minutes after sitemap automation completes.
 * Completely independent of the user's configured reporting schedule.
 * Reuses the same reportingIsProcessing mutex to prevent duplicate sends.
 */
export async function checkPostAutomationReport(callerLabel = "UNKNOWN") {
    try {
        await connectDB();

        const now = new Date();

        // Check if a post-automation run is pending and due
        const settings = await Settings.findOne({});
        if (!settings?.reportingPostAutomationRunDate) return null;
        if (new Date(settings.reportingPostAutomationRunDate) > now) return null; // Not due yet

        // If toggle is OFF: clear the trigger date but don't send — items stay in queue
        if (!settings.reportingEnabled) {
            await Settings.findOneAndUpdate({}, { $set: { reportingPostAutomationRunDate: null } });
            console.log(`[POST-AUTO-REPORT] Toggle is OFF. Queue retained. Trigger cleared.`);
            return null;
        }

        // Check queue has items — no point running if empty
        const queueCount = await SitemapBatchQueue.countDocuments({ status: "queued" });
        if (queueCount === 0) {
            await Settings.findOneAndUpdate({}, { $set: { reportingPostAutomationRunDate: null } });
            console.log(`[POST-AUTO-REPORT] Queue is empty. Trigger cleared.`);
            return null;
        }

        // --- ATOMIC MUTEX: shares lock with the regular schedule to prevent duplicate sends ---
        const lockResult = await Settings.findOneAndUpdate(
            {
                reportingIsProcessing: false,
                reportingPostAutomationRunDate: { $lte: now, $ne: null }
            },
            { $set: { reportingIsProcessing: true, reportingPostAutomationRunDate: null } },
            { new: true }
        );

        if (!lockResult) {
            // Another process holds the lock (regular schedule ran concurrently)
            return null;
        }

        console.log(`[POST-AUTO-REPORT] ✓ Lock acquired by [${callerLabel}]. Dispatching post-automation report...`);
        await SitemapLog.create({
            status: "INFO",
            logCategory: "reporting",
            message: `Post-automation reporting run triggered (5-min delay after sitemap automation).`,
            itemCount: queueCount,
            details: `Trigger: Post-Automation (5-min delay) | Caller: ${callerLabel} | Items in queue: ${queueCount} | Recipient: ${lockResult.notificationEmail || lockResult.senderEmail || "not configured"}`
        });

        const recipientEmail = lockResult.notificationEmail || lockResult.senderEmail;

        try {
            return await sendBatchDispatch(recipientEmail, true, "Post-Automation (5-min delay)");
        } finally {
            await Settings.findOneAndUpdate(
                { reportingIsProcessing: true },
                { $set: { reportingIsProcessing: false } }
            );
        }

    } catch (error) {
        console.error(`[POST-AUTO-REPORT] Error:`, error.message);
        await SitemapLog.create({
            status: "ERROR",
            logCategory: "reporting",
            message: `Post-automation reporting failed: ${error.message}`,
            details: `Trigger: Post-Automation (5-min delay) | Caller: ${callerLabel}`
        }).catch(() => {});
        try {
            await Settings.findOneAndUpdate(
                { reportingIsProcessing: true },
                { $set: { reportingIsProcessing: false } }
            );
        } catch (_) { /* ignore */ }
        return null;
    }
}

/**
 * CORE SITEMAP SUBMISSION LOGIC
 * Encapsulates the GSC API request and local database updates.
 * Reused by both manual API and automated scheduler.
 */
export async function submitSitemapInternal(userId, siteUrl, feedpath, options = {}) {
    const { skipEmail = false, forceHealthCheck = true } = options;

    try {
        await connectDB();

        // 1. Fetch Service Accounts for the user
        const accounts = await ServiceAccount.find({ userId, isValid: true });
        if (!accounts.length) {
            throw new Error("No valid service accounts found for this user.");
        }

        const encodedSiteUrl = encodeURIComponent(siteUrl);
        const encodedFeedpath = encodeURIComponent(feedpath);
        const apiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/sitemaps/${encodedFeedpath}`;

        let lastError = "No valid service account found for this property.";
        let submissionSuccess = false;
        let usedAccount = null;

        // 2. Iterate accounts to find one with permissions
        for (const acc of accounts) {
            try {
                const decryptedText = decrypt(acc.encryptedJson);
                if (!decryptedText) continue;
                const creds = JSON.parse(decryptedText);

                const jwtClient = new google.auth.JWT({
                    email: creds.client_email,
                    key: creds.private_key,
                    scopes: ["https://www.googleapis.com/auth/webmasters"],
                });

                const tokens = await jwtClient.authorize();
                const res = await fetch(apiUrl, {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${tokens.access_token}`,
                        "Content-Type": "application/json",
                    },
                });

                if (res.status === 403 || res.status === 401) {
                    lastError = "Permission denied or Authentication failed.";
                    continue;
                }

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    lastError = errData?.error?.message || `GSC API Error ${res.status}`;
                    continue;
                }

                submissionSuccess = true;
                usedAccount = acc;
                break;
            } catch (err) {
                lastError = err.message;
            }
        }

        if (!submissionSuccess) {
            const failMsg = `Sitemap submission failed for ${feedpath}: ${lastError}`;
            console.error(`[SUBMIT-SERVICE] ❌ ${failMsg}`);
            await SitemapLog.create({ status: "ERROR", logCategory: "sitemap", message: failMsg, details: lastError });
            throw new Error(lastError);
        }

        const successMsg = `Sitemap submission success for ${feedpath}`;
        console.log(`[SUBMIT-SERVICE] ✅ ${successMsg}`);
        // Removed SitemapLog.create so we don't spam individual successes in the UI

        // 3. Resolve Recipient Email for attribution/notifications
        const user = await User.findById(userId);
        let recipientEmail = user?.email;
        if (user?.verifiedSites) {
            const siteMatch = user.verifiedSites.find(vs => {
                const normalizedVs = vs.url.toLowerCase().replace(/\/$/, "").replace(/^https?:\/\//, "").replace(/^www\./, "");
                const normalizedTarget = siteUrl.toLowerCase().replace(/\/$/, "").replace(/^https?:\/\//, "").replace(/^www\./, "");
                return normalizedVs === normalizedTarget;
            });
            if (siteMatch?.accountEmail) {
                recipientEmail = siteMatch.accountEmail;
            }
        }

        // 4. Update Sitemap Record
        const sitemapRecord = await Sitemap.findOneAndUpdate(
            { userId, siteUrl, feedpath },
            {
                status: "PROCESSING",
                lastCheckedAt: new Date(),
                isDeleted: false,
                accountEmail: recipientEmail
            },
            { upsert: true, new: true }
        );

        // 5. Trigger Orchestrated Health Check (internal call, not fetch)
        // We use a non-blocking promise approach to mirror the background behavior
        orchestrateSitemapHealthCheck(sitemapRecord._id, userId, { 
            force: forceHealthCheck, 
            skipImmediateEmail: skipEmail  // skipEmail suppresses one-off emails; queue insertion still happens
        }).catch(err => console.error(`[INTERNAL-TASK] Health check orchestration failed for ${feedpath}:`, err.message));

        const settings = await Settings.findOne({});
        const batchingEnabled = settings?.sitemapBatchingEnabled ?? false;

        return {
            success: true,
            sitemapId: sitemapRecord._id,
            recipientEmail,
            batchingEnabled,
            message: batchingEnabled
                ? `Submission complete. Final report will be batched.`
                : `Submission complete. Report sent to ${recipientEmail || usedAccount.clientEmail}`
        };

    } catch (error) {
        console.error("submitSitemapInternal Error:", error.message);
        throw error;
    }
}

/**
 * HEALTH CHECK ORCHESTRATION ENGINE
 * Executes the diagnostics, updates the database, handles batching/reporting, and logs the result.
 */
export async function orchestrateSitemapHealthCheck(sitemapId, userId, options = {}) {
    const { force = false, skipEmail = false } = options;
    // skipEmail = skip ALL email (immediate + queue). For auto-runs we only want to skip
    // immediate one-off emails but still queue items for the batch reporter.
    // Use skipImmediateEmail to control this split behavior.
    const skipImmediateEmail = options.skipImmediateEmail ?? skipEmail;

    try {
        await connectDB();
        const sitemap = await Sitemap.findById(sitemapId);
        if (!sitemap) throw new Error("Sitemap not found");

        // 1. Guard against excessive checks (unless forced)
        if (!force && sitemap.status !== "PENDING" && sitemap.lastCheckedAt) {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (sitemap.lastCheckedAt > fiveMinutesAgo) {
                return { success: true, message: "Skipped: Checked recently" };
            }
        }

        const startMsg = `Sitemap health scan started for ${sitemap.feedpath}`;
        console.log(`[HEALTH-SERVICE] 🔍 ${startMsg}`);
        // Removed SitemapLog.create so we don't spam individual scan starts in the UI

        // 2. Perform the intensive URL scan
        sitemap.status = "PROCESSING";
        await sitemap.save();

        console.log(`[ORCHESTRATOR] 🩺 Starting health check for: ${sitemap.feedpath} (SkipEmail: ${skipEmail})`);
        const result = await performHealthCheck(sitemap.feedpath);

        // 3. Update Sitemap Record
        sitemap.status = result.status === "SUCCESS" ? "ACTIVE" : "ERROR";
        sitemap.lastCheckedAt = new Date();
        sitemap.errorCount = result.summary.errorCount;
        await sitemap.save();

        // 4. Reporting/Batching Logic
        let emailResponse = null;

        // Always resolve recipient (needed for both queue insertion and immediate email)
        const user = await User.findById(userId);
        let recipientEmail = user?.email;
        if (user?.verifiedSites) {
            const normalizedSm = sitemap.siteUrl.toLowerCase().replace(/\/$/, "").replace(/^https?:\/\//, "").replace(/^www\./, "");
            const siteMatch = user.verifiedSites.find(vs => {
                const normalizedVs = vs.url.toLowerCase().replace(/\/$/, "").replace(/^https?:\/\//, "").replace(/^www\./, "");
                return normalizedVs === normalizedSm;
            });
            if (siteMatch?.accountEmail) recipientEmail = siteMatch.accountEmail;
        }

        const settings = await Settings.findOne({});
        const batchingEnabled = settings?.sitemapBatchingEnabled ?? false;

        if (batchingEnabled && recipientEmail) {
            // Always add to batch queue — regardless of skipEmail/skipImmediateEmail.
            // Queue is the source of truth for batch reporting; skip flags only gate one-off emails.
            await SitemapBatchQueue.create({
                sitemapUrl: sitemap.feedpath,
                userEmail: recipientEmail,
                status: "queued",
                healthStatus: (result.status === "ERROR" || result.summary.errorCount > 0) ? "ERROR" : "SUCCESS",
                errorCount: result.summary.errorCount || 0,
                responseTimeMs: result.summary.responseTimeMs || 0,
                errorLogs: result.errors || [],
                submittedAt: new Date(),
                checkedAt: new Date()
            });
            emailResponse = { status: "QUEUED", message: "Item added to batch" };
        } else if (recipientEmail && !skipImmediateEmail) {
            // Only send immediate one-off email if NOT skipped
            const recipients = recipientEmail.split(",").map(r => r.trim()).filter(r => r);
            const emailResults = await Promise.all(recipients.map(async (to) => {
                return await sendHealthCheckEmail({
                    to,
                    sitemapUrl: sitemap.feedpath,
                    status: result.status,
                    summary: result.summary,
                    errorLogs: result.errors,
                });
            }));
            const successResult = emailResults.find(r => r.success);
            emailResponse = (successResult || emailResults[emailResults.length - 1])?.rawResponse;
        } else if (skipImmediateEmail) {
            console.log(`[ORCHESTRATOR] 🔇 Immediate email suppressed for: ${sitemap.feedpath} (batch queue used instead).`);
        }

        // 5. Create Health Check Log
        const log = await HealthCheckLog.create({
            userId,
            sitemapId,
            feedpath: sitemap.feedpath,
            status: result.status,
            summary: result.summary,
            errorLogs: result.errors,
            emailResponse: emailResponse,
            checkedAt: new Date(),
        });

        return { success: true, logId: log._id, status: result.status };

    } catch (error) {
        console.error("[ORCHESTRATOR] Health Check Error:", error.message);
        throw error;
    }
}

/**
 * LIVE DISCOVERY HELPER
 * Auth with Service Account and fetch current sitemaps list from GSC for a site.
 */
async function fetchLiveSitemapsFromGSC(userId, siteUrl) {
    const accounts = await ServiceAccount.find({ userId, isValid: true });
    if (!accounts.length) return [];

    for (const acc of accounts) {
        try {
            const decryptedText = decrypt(acc.encryptedJson);
            if (!decryptedText) continue;
            const creds = JSON.parse(decryptedText);

            const jwtClient = new google.auth.JWT({
                email: creds.client_email,
                key: creds.private_key,
                scopes: ["https://www.googleapis.com/auth/webmasters"],
            });

            await jwtClient.authorize();
            const webmasters = google.webmasters({ version: "v3", auth: jwtClient });
            const res = await webmasters.sitemaps.list({ siteUrl });
            
            return res.data.sitemap || [];
        } catch (err) {
            // Silently try next account
            continue;
        }
    }
    return [];
}

/**
 * UNIVERSAL RE-SUBMISSION ENGINE
 * Dynamically identifies all connected websites, fetches their live sitemap list
 * from GSC, and triggers a fresh re-submission for each.
 */
export async function executeUniversalResubmission(callerLabel = "AUTO-SCHEDULER") {
    try {
        await connectDB();

        // 1. Fetch Settings and Validate if run is due
        const settings = await Settings.findOne({});
        
        console.log(`[RE-SUBMISSION] 🚦 Engine triggered by [${callerLabel}].`);
        // Removed SitemapLog.create for "started" point to limit UI noise

        // Master Toggle Check
        if (!settings?.sitemapBatchingEnabled) {
             const errorMsg = "Sitemap automation is disabled. Please enable it in the Live Dashboard to execute runs.";
             console.log(`[RE-SUBMISSION] GUARD FAIL: Master Toggle is OFF.`);
             
             // Create new system log
             await SitemapLog.create({ status: "ERROR", logCategory: "system", message: errorMsg });

             // Prune old system logs (keep only latest 20) — prevents DB bloat from 1-min heartbeat
             try {
                 const count = await SitemapLog.countDocuments({ logCategory: "system" });
                 if (count > 20) {
                     const newest = await SitemapLog.find({ logCategory: "system" })
                         .sort({ timestamp: -1 })
                         .limit(20)
                         .select("_id");
                     
                     if (newest.length > 0) {
                         const newestIds = newest.map(n => n._id);
                         await SitemapLog.deleteMany({
                             logCategory: "system",
                             _id: { $nin: newestIds }
                         });
                     }
                 }
             } catch (pruneErr) {
                 console.error("[PRUNE-LOGS] Failed to prune system logs:", pruneErr.message);
             }

             return { success: false, message: errorMsg };
        }

        // Processing Lock Check
        if (settings?.sitemapIsProcessing) {
            console.log(`[RE-SUBMISSION] GUARD SKIP: Engine already processing.`);
            return { success: true, message: "Engine Busy" };
        }

        // Interval Check
        const now = new Date();
        if (callerLabel !== "MANUAL" && settings?.sitemapNextRunDate && settings.sitemapNextRunDate > now) {
            console.log(`[RE-SUBMISSION] GUARD SKIP: Not due yet.`);
            return { success: true, message: "Not Due" };
        }

        // All guards passed

        // 2. Lock Engine
        await Settings.findOneAndUpdate({}, { $set: { sitemapIsProcessing: true } });
        console.log(`[RE-SUBMISSION] Engine locked. Starting discovery.`);

        // 3. Fetch All Users with Connected Websites
        const users = await User.find({ "verifiedSites.0": { $exists: true } }).lean();
        console.log(`[RE-SUBMISSION] Found ${users.length} user(s).`);

        if (!users.length) {
            const noSitesMsg = `No verified sites found to process.`;
            console.log(`[RE-SUBMISSION] ${noSitesMsg}`);
            await SitemapLog.create({ status: "INFO", logCategory: "sitemap", message: noSitesMsg });
            await Settings.findOneAndUpdate({}, { $set: { sitemapIsProcessing: false } });
            return { success: true, count: 0 };
        }

        const stats = { success: 0, failed: 0, details: [] };
        const cycleStartTime = new Date();

        // 4. Process each User and their Sites
        for (const user of users) {
            const activeSites = (user.verifiedSites || []).filter(s => s.status === "SUCCESS");
            console.log(`[RE-SUBMISSION] User ${user.email || user._id}: ${activeSites.length} active site(s).`);

            for (const site of activeSites) {
                const siteUrl = site.url;
                console.log(`[RE-SUBMISSION] Calling GSC API for ${siteUrl}`);

                try {
                    const liveSitemaps = await fetchLiveSitemapsFromGSC(user._id, siteUrl);
                    
                    if (!liveSitemaps.length) {
                        console.log(`[RE-SUBMISSION] GSC returned 0 sitemaps for ${siteUrl}.`);
                        await SitemapLog.create({ status: "INFO", logCategory: "sitemap", message: `Sitemap submission skipped for ${siteUrl} (No sitemaps found in GSC)` });
                        continue;
                    }

                    console.log(`[RE-SUBMISSION] Found ${liveSitemaps.length} sitemap(s) for ${siteUrl}.`);

                    for (const gscSm of liveSitemaps) {
                        const feedpath = gscSm.path;
                        console.log(`[RE-SUBMISSION] Submitting: ${feedpath}`);

                        try {
                            await submitSitemapInternal(user._id, siteUrl, feedpath, { 
                                skipEmail: true,
                                forceHealthCheck: true 
                            });

                            stats.success++;
                            // Silent individual success logged in stats
                            stats.details.push({ siteUrl, sitemapUrl: feedpath, healthStatus: "SUCCESS", message: "Re-submitted successfully." });
                        } catch (subErr) {
                            stats.failed++;
                            console.error(`[RE-SUBMISSION] FAIL -> ${feedpath}: ${subErr.message}`);
                            await SitemapLog.create({ status: "ERROR", logCategory: "sitemap", message: `Failed to submit sitemap (${feedpath}): ${subErr.message}` });
                            stats.details.push({ siteUrl, sitemapUrl: feedpath, healthStatus: "ERROR", message: subErr.message });
                        }
                        
                        await new Promise(r => setTimeout(r, 250));
                    }
                } catch (discoveryErr) {
                    console.error(`[RE-SUBMISSION] API ERROR for ${siteUrl}: ${discoveryErr.message}`);
                    await SitemapLog.create({ status: "ERROR", logCategory: "sitemap", message: `GSC Error for ${siteUrl}: ${discoveryErr.message}` });
                }
            }
        }

        // 5. Summary log
        const summaryMsg = `Sitemap automation completed. Processed ${stats.success + stats.failed} sitemap(s) (${stats.success} successful, ${stats.failed} failed).`;
        console.log(`[RE-SUBMISSION] ✓ ${summaryMsg}`);

        await SitemapLog.create({
            status: stats.failed > 0 ? "ERROR" : "SUCCESS",
            logCategory: "sitemap",
            message: summaryMsg,
            itemCount: stats.success + stats.failed,
            items: stats.details
        });

        // 6. Reschedule
        try {
            const nextRun = calculateNextDynamicRun(settings, "sitemap");
            const postAutomationReportTime = new Date(Date.now() + 5 * 60 * 1000);
            await Settings.findOneAndUpdate({}, {
                $set: {
                    sitemapLastRunDate: cycleStartTime,
                    sitemapNextRunDate: nextRun,
                    sitemapIsProcessing: false,
                    // Separate post-automation trigger: fires 5 min after automation.
                    // Does NOT touch reportingNextRunDate so user schedule is untouched.
                    reportingPostAutomationRunDate: postAutomationReportTime,
                }
            });
            console.log(`[RE-SUBMISSION] Rescheduled. Next run = ${nextRun.toLocaleString()}. Post-automation report queued for ${postAutomationReportTime.toLocaleString()}`);
        } catch (reschedErr) {
            console.error("[RE-SUBMISSION] Rescheduling error:", reschedErr.message);
        }

        return { success: true, stats };
        
    } catch (error) {
        console.error(`[RE-SUBMISSION] Unhandled error: ${error.message}`);
        await SitemapLog.create({ status: "ERROR", logCategory: "sitemap", message: `Automation encountered an unexpected error: ${error.message}` }).catch(() => {});
        await Settings.findOneAndUpdate({}, { $set: { sitemapIsProcessing: false } });
        return { success: false, error: error.message };
    }
}
