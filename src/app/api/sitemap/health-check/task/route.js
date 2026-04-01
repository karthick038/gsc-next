import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Sitemap from "@/models/Sitemap";
import HealthCheckLog from "@/models/HealthCheckLog";
import ServiceAccount from "@/models/ServiceAccount";
import User from "@/models/User";
import Settings from "@/models/Settings";
import SitemapBatchQueue from "@/models/SitemapBatchQueue";
import { performHealthCheck } from "@/lib/health-check-service";
import { sendHealthCheckEmail } from "@/lib/mailer-v2";

/**
 * Background worker task for running sitemap health checks
 * This is triggered internally and should not be public/exposed if possible in production
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { sitemapId, userId, force = false } = body;

        if (!sitemapId || !userId) {
            return NextResponse.json({ error: "Missing sitemapId or userId" }, { status: 400 });
        }

        await connectDB();

        const sitemap = await Sitemap.findById(sitemapId);
        if (!sitemap) {
            return NextResponse.json({ error: "Sitemap not found" }, { status: 404 });
        }

        // 1. Mark as Processing (unless already done recently and not forced)
        if (!force && sitemap.status !== "PENDING" && sitemap.lastCheckedAt) {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (sitemap.lastCheckedAt > fiveMinutesAgo) {
                console.log(`[HEALTH-CHECK] Skipping recent check for: ${sitemap.feedpath} (Force: ${force})`);
                return NextResponse.json({ success: true, message: "Checked recently" });
            }
        }

        sitemap.status = "PROCESSING";
        await sitemap.save();

        // 2. Perform health check
        console.log(`Starting background health check for: ${sitemap.feedpath}`);
        const result = await performHealthCheck(sitemap.feedpath);

        // 3. Update Sitemap record
        sitemap.status = result.status; // ACTIVE or ERROR
        // Map SUCCESS to ACTIVE for UI clarity
        if (result.status === "SUCCESS") sitemap.status = "ACTIVE";

        sitemap.lastCheckedAt = new Date();
        sitemap.errorCount = result.summary.errorCount;
        await sitemap.save();

        // 5. Send Email if necessary and capture response
        // We want to send to the user's personal email or the specific accountEmail configured for this site.
        const user = await User.findById(userId);
        let recipientEmail = user?.email;

        if (user && user.verifiedSites) {
            const siteMatch = user.verifiedSites.find(vs => {
                const normalizedVs = vs.url.toLowerCase().replace(/\/$/, "").replace(/^https?:\/\//, "").replace(/^www\./, "");
                const normalizedSm = sitemap.siteUrl.toLowerCase().replace(/\/$/, "").replace(/^https?:\/\//, "").replace(/^www\./, "");
                return normalizedVs === normalizedSm;
            });
            if (siteMatch?.accountEmail) {
                recipientEmail = siteMatch.accountEmail;
            }
        }

        let emailResponse = null;
        
        // --- NEW: Check if Batching is enabled ---
        const settings = await Settings.findOne({});
        const batchingEnabled = settings?.sitemapBatchingEnabled ?? false;

        if (batchingEnabled && recipientEmail) {
            console.log(`[HEALTH-CHECK] Batching enabled. Queueing report for: ${sitemap.feedpath}`);
            
            // Derive health status strictly: any URL errors = ERROR, regardless of mapping
            const queueHealthStatus = (result.status === "ERROR" || (result.summary.errorCount > 0))
                ? "ERROR"
                : "SUCCESS";

            await SitemapBatchQueue.create({
                sitemapUrl: sitemap.feedpath,
                userEmail: recipientEmail,
                status: "queued",
                healthStatus: queueHealthStatus,
                errorCount: result.summary.errorCount || 0,
                responseTimeMs: result.summary.responseTimeMs || 0,
                errorLogs: result.errors || [],
                submittedAt: new Date(),
                checkedAt: new Date()
            });
            
            // --- REFINED: Ensure NextRun is set (14-day Friday window) ---
            // If already set, do nothing. If null, set it.
            let nextRun = settings?.sitemapNextRunDate;
             if (!nextRun) {
                const { calculate14DayFridayWindow } = require("@/lib/sitemap-service");
                nextRun = calculate14DayFridayWindow(new Date());
                await Settings.findOneAndUpdate({}, { $set: { sitemapNextRunDate: nextRun } });
                console.log(`[CRON SCHEDULED] First sitemap queued. 14-day Friday schedule set: ${nextRun.toLocaleString()}`);
            } else {
                console.log(`[CRON SCHEDULED] Item added to existing batch. Next run: ${nextRun.toLocaleString()}`);
            }

            emailResponse = { status: "QUEUED", message: "Batching enabled, item added to queue." };
        } else if (recipientEmail) {
            const recipients = recipientEmail.split(",").map(r => r.trim()).filter(r => r);
            console.log(`[HEALTH-CHECK] Triggering immediate email report to ${recipients.length} recipients for sitemap: ${sitemap.feedpath} (status: ${result.status})`);

            const emailResults = await Promise.all(recipients.map(async (to) => {
                try {
                    return await sendHealthCheckEmail({
                        to,
                        sitemapUrl: sitemap.feedpath,
                        status: result.status,
                        summary: result.summary,
                        errorLogs: result.errors,
                    });
                } catch (err) {
                    console.error(`[HEALTH-CHECK] Failed to send email to ${to}:`, err.message);
                    return { success: false, error: err.message };
                }
            }));

            // Store the first successful raw response or the last error for the log
            const successResult = emailResults.find(r => r.success);
            emailResponse = (successResult || emailResults[emailResults.length - 1])?.rawResponse;
            console.log(`[HEALTH-CHECK] Group email sending completed. Successes: ${emailResults.filter(r => r.success).length}/${recipients.length}`);
        } else {
            console.warn(`[HEALTH-CHECK] No email recipient found for health check report (User: ${userId})`);
        }

        // 6. Save Log (with emailResponse if available)
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

        return NextResponse.json({ success: true, logId: log._id });

    } catch (error) {
        console.error("Health Check Task Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
