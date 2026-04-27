import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Settings from "@/models/Settings";
import SitemapLog from "@/models/SitemapLog";

// This route has a shared secret so only our internal worker can trigger it
const INTERNAL_SECRET = process.env.INTERNAL_CRON_SECRET || "gsc-internal-cron-2026";

export const dynamic = "force-dynamic";

export async function POST(request) {
    try {
        // Validate internal secret to prevent unauthorized calls
        const authHeader = request.headers.get("x-internal-secret");
        if (authHeader !== INTERNAL_SECRET) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await connectDB();
        const { executeUniversalResubmission, checkAndDispatchSitemapBatch } = require("@/lib/sitemap-service");

        console.log("[CRON] 🕒 Heartbeat detected. Checking independent schedules...");

        // 1. Trigger Sitemap Engine (if due)
        // executeUniversalResubmission handles its own internal locks/checks via sitemap* fields
        const sitemapPromise = executeUniversalResubmission("CRON-WORKER");

        // 2. Trigger Reporting Engine (if due) 
        // checkAndDispatchSitemapBatch now handles reporting* fields internally
        const reportingPromise = checkAndDispatchSitemapBatch("CRON-WORKER");

        const [sitemapResult, reportingResult] = await Promise.all([
            sitemapPromise,
            reportingPromise
        ]);

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            engines: {
                sitemap: sitemapResult || { status: "Idle/Skipped" },
                reporting: reportingResult || { status: "Idle/Skipped" }
            }
        });

    } catch (error) {
        console.error("[CRON] Fatal error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
