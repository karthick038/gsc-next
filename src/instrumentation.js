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
            try {
                const svc = await import("./lib/sitemap-service");
                checkAndDispatchSitemapBatch = svc.checkAndDispatchSitemapBatch;
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
            console.log("🚀 [GLOBAL-WORKER] Sitemap Scheduler active.");
            console.log("⏰ [GLOBAL-WORKER] Checking every 60s — direct service call.");
            console.log("------------------------------------------------------------------");

            const tick = async () => {
                const timeStr = new Date().toLocaleTimeString();
                console.log(`[GLOBAL-WORKER] ⏰ Heartbeat tick @ ${timeStr}`);
                try {
                    const result = await checkAndDispatchSitemapBatch("BACKGROUND-WORKER");
                    if (result?.success) {
                        console.log(`[GLOBAL-WORKER] ✅ Batch dispatched to: ${result.recipientEmail}`);
                    }
                } catch (err) {
                    console.error("[GLOBAL-WORKER] ❌ Tick error:", err.message);
                }
            };

            // First tick immediately (after warmup), then every 60 seconds
            await tick();
            setInterval(tick, 60_000);
        })();
    }
}
