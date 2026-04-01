import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/db";
import SitemapBatchQueue from "@/models/SitemapBatchQueue";
import Settings from "@/models/Settings";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await auth();
        if (session?.user?.role?.toLowerCase() !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();

        const queuedItems = await SitemapBatchQueue.find({ status: "queued" })
            .sort({ submittedAt: 1 })
            .limit(100);

        const settings = await Settings.findOne({});

        // --- PASSIVE TRIGGER: Safety net if background worker missed the schedule ---
        if (settings?.sitemapBatchingEnabled && queuedItems.length > 0 && !settings.sitemapIsProcessing) {
            if (settings.sitemapNextRunDate && new Date() >= new Date(settings.sitemapNextRunDate)) {
                console.log("[AUTO-BATCH] Schedule overdue on page visit — triggering dispatch...");
                // Fire-and-forget: import and call the service directly (no HTTP)
                import("@/lib/sitemap-service")
                    .then(({ checkAndDispatchSitemapBatch }) =>
                        checkAndDispatchSitemapBatch("PAGE-VISIT-SAFETY-NET")
                    )
                    .catch(err => console.error("[AUTO-BATCH] Safety-net dispatch error:", err.message));
            }
        }

        return NextResponse.json({
            items: queuedItems,
            isProcessing: !!settings?.sitemapIsProcessing
        });
    } catch (error) {
        console.error("Queue Fetch Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const session = await auth();
        if (session?.user?.role?.toLowerCase() !== "admin") {
            console.warn("Unauthorized attempt to clear sitemap queue.", { user: session?.user?.email });
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log("Clearing sitemap queue - Requested by:", session.user.email);
        await connectDB();
        const result = await SitemapBatchQueue.deleteMany({ status: "queued" });

        // Clear the schedule too so the Next Run resets
        await Settings.findOneAndUpdate({}, {
            $set: { sitemapNextRunDate: null, sitemapIsProcessing: false }
        });

        console.log("Sitemap queue clear results:", result);
        return NextResponse.json({
            success: true,
            message: `Sitemap queue cleared successfully (${result.deletedCount} items).`
        });
    } catch (error) {
        console.error("Queue Clear Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
