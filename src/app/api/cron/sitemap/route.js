import { NextResponse } from "next/server";
import { checkAndDispatchSitemapBatch } from "@/lib/sitemap-service";

export const dynamic = "force-dynamic"; // Ensure it's never statically cached

export async function GET(request) {
    console.log("[CRON SECURE CHECK] Server-level cron execution started...");

    // Optional: You can secure this route by checking a secret key in the headers/query
    // const authHeader = request.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //     return new Response('Unauthorized', { status: 401 });
    // }

    try {
        const result = await checkAndDispatchSitemapBatch();

        if (result === null) {
            console.log("[CRON PASS] No overdue schedules found or queue is empty. Standing by.");
            return NextResponse.json({ success: true, message: "No overdue batches to process." });
        }

        if (result.success) {
            console.log(`[CRON EXECUTION SUCCESS] Batch process dispatched. Cleaned up queue.`);
            return NextResponse.json({ success: true, message: "Batch dispatched and queue cleared." });
        } else {
            console.error("[CRON EXECUTION FAILED] Batch process error:", result.error);
            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }

    } catch (error) {
        console.error("[CRON FATAL ERROR]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
