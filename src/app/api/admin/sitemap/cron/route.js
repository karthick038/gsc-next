import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Settings from "@/models/Settings";
import connectDB from "@/lib/db";
import Settings from "@/models/Settings";

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

        const settings = await Settings.findOne({});

        if (!settings?.sitemapBatchingEnabled) {
            return NextResponse.json({ skipped: true, reason: "Batching disabled" });
        }

        // --- STALE LOCK RECOVERY ---
        if (settings.sitemapIsProcessing && settings.sitemapNextRunDate) {
            const twoMinsPast = new Date(settings.sitemapNextRunDate.getTime() + 2 * 60 * 1000);
            if (new Date() > twoMinsPast) {
                console.log("[CRON] Stale lock detected. Force-releasing...");
                await Settings.findOneAndUpdate({}, { $set: { sitemapIsProcessing: false } });
                await SitemapLog.create({ status: "INFO", message: "Stale processing lock force-released by cron." });
            }
        }

        // --- CHECK IF DISPATCH IS DUE ---
        const freshSettings = await Settings.findOne({});
        if (!freshSettings?.sitemapNextRunDate) {
            return NextResponse.json({ skipped: true, reason: "No schedule set" });
        }
        if (freshSettings.sitemapIsProcessing) {
            return NextResponse.json({ skipped: true, reason: "Already processing" });
        }
        if (new Date() < new Date(freshSettings.sitemapNextRunDate)) {
            const secsRemaining = Math.round((new Date(freshSettings.sitemapNextRunDate) - new Date()) / 1000);
            return NextResponse.json({ skipped: true, reason: `Not due yet (${secsRemaining}s remaining)` });
        }

        // --- ATOMIC LOCK ACQUISITION ---
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
            return NextResponse.json({ skipped: true, reason: "Lock not acquired (race condition)" });
        }

        console.log("[CRON] ✓ Lock acquired. Starting batch dispatch...");

        const recipientEmail = lockResult.notificationEmail || lockResult.senderEmail;
        const { sendBatchDispatch } = require("@/lib/sitemap-service");
        
        try {
            // We pass the lockResult's notificationEmail as a fallback adminEmail
            const result = await sendBatchDispatch(recipientEmail, true);

            if (!result.success) {
                return NextResponse.json({ success: false, error: result.error });
            }

            return NextResponse.json({ success: true, summary: result.summary, sentAt: result.sentAt });

        } finally {
            // Always release the lock
            await Settings.findOneAndUpdate(
                { sitemapIsProcessing: true },
                { $set: { sitemapIsProcessing: false } }
            );
        }

    } catch (error) {
        console.error("[CRON] Fatal error:", error.message);
        // Emergency lock release
        try {
            await connectDB();
            await Settings.findOneAndUpdate(
                { sitemapIsProcessing: true },
                { $set: { sitemapIsProcessing: false } }
            );
        } catch (_) {}
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
