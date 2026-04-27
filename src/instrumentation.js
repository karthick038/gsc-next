/**
 * Next.js Instrumentation — runs once when the Node.js server process starts.
 *
 * Registers a true background scheduler that calls the sitemap batch dispatcher
 * directly (no HTTP) every 60 seconds. This ensures emails are sent at the
 * scheduled Next Run time with zero user interaction required.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {

        // Non-blocking IIFE — server startup is not delayed at all
        (async () => {
            // Wait 15s for the server to fully boot and DB to warm up
            await new Promise(resolve => setTimeout(resolve, 15_000));

            let checkAndDispatchSitemapBatch;
            let executeUniversalResubmission;
            let checkPostAutomationReport;

            try {
                const svc = await import("./lib/sitemap-service");
                checkAndDispatchSitemapBatch = svc.checkAndDispatchSitemapBatch;
                executeUniversalResubmission = svc.executeUniversalResubmission;
                checkPostAutomationReport = svc.checkPostAutomationReport;
            } catch (importErr) {
                console.error("[GLOBAL-WORKER] FATAL: Could not import sitemap-service:", importErr.message);
                return;
            }

            // Clear any stuck lock left over from a previous crash
            try {
                const connectDB = (await import("./lib/db")).default;
                const Settings = (await import("./models/Settings")).default;
                await connectDB();
                const released = await Settings.findOneAndUpdate(
                    { sitemapIsProcessing: true },
                    { $set: { sitemapIsProcessing: false } }
                );
                if (released) {
                    console.log("[GLOBAL-WORKER] ⚠️  Startup: cleared a stale processing lock from previous session.");
                }
            } catch (e) {
                // Non-fatal — best-effort cleanup
                console.error("[GLOBAL-WORKER] Startup lock-clear error (non-fatal):", e.message);
            }

            console.log("------------------------------------------------------------------");
            console.log("🚀 [GLOBAL-WORKER] Sitemap Automation active.");
            console.log("⏰ [GLOBAL-WORKER] Checking every 60s — direct service call.");
            console.log("------------------------------------------------------------------");

            const tick = async () => {
                const timeStr = new Date().toLocaleTimeString();
                console.log(`[GLOBAL-WORKER] ⏰ Heartbeat tick @ ${timeStr}`);
                try {
                    // 1. Check for due Sitemap Re-submissions
                    await executeUniversalResubmission("BACKGROUND-WORKER");

                    // 2. Check user-configured Reporting schedule
                    const result = await checkAndDispatchSitemapBatch("BACKGROUND-WORKER");
                    if (result?.success) {
                        console.log(`[GLOBAL-WORKER] ✅ Batch dispatched to: ${result.recipientEmail}`);
                    }

                    // 3. Check post-automation 5-minute trigger (independent of user schedule)
                    const postResult = await checkPostAutomationReport("BACKGROUND-WORKER");
                    if (postResult?.success) {
                        console.log(`[GLOBAL-WORKER] ✅ Post-automation report dispatched.`);
                    }
                } catch (err) {
                    console.error("[GLOBAL-WORKER] ❌ Tick error:", err.message);
                    try {
                        const SitemapLog = (await import("./models/SitemapLog")).default;
                        await SitemapLog.create({
                            status: "ERROR",
                            message: `FATAL BACKGROUND ERROR: ${err.message}`,
                            details: err.stack
                        });
                    } catch (logErr) {
                        console.error("[GLOBAL-WORKER] Could not persist fatal error to DB:", logErr.message);
                    }
                }

                // --- ADAPTIVE INTERVAL ---
                // Read current settings to decide when to check next.
                // 5_MINS (test mode) or automation disabled → check every 5 minutes.
                // Day-based intervals (1_DAY, 7_DAYS, 14_DAYS) → check every 1 hour.
                let nextIntervalMs = 5 * 60_000; // default: 5 minutes
                try {
                    const connectDB = (await import("./lib/db")).default;
                    const Settings = (await import("./models/Settings")).default;
                    await connectDB();
                    const s = await Settings.findOne({}).lean();
                    const interval = s?.sitemapInterval || "5_MINS";
                    const isEnabled = s?.sitemapBatchingEnabled ?? true;
                    const isShortInterval = !isEnabled || interval === "5_MINS";
                    nextIntervalMs = isShortInterval ? 5 * 60_000 : 60 * 60_000; // 5 min or 1 hour
                    console.log(`[GLOBAL-WORKER] ⏱ Next check in ${isShortInterval ? "5 min" : "1 hour"} (interval=${interval}, enabled=${isEnabled})`);
                } catch (settingsErr) {
                    console.error("[GLOBAL-WORKER] Could not read settings for adaptive interval:", settingsErr.message);
                }

                setTimeout(tick, nextIntervalMs);
            };

            // First tick immediately (after warmup), then self-schedules adaptively
            tick();
        })();
    }
}
