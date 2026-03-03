import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Sitemap from "@/models/Sitemap";
import HealthCheckLog from "@/models/HealthCheckLog";
import ServiceAccount from "@/models/ServiceAccount";
import { performHealthCheck } from "@/lib/health-check-service";
import { sendHealthCheckEmail } from "@/lib/mailer";

/**
 * Background worker task for running sitemap health checks
 * This is triggered internally and should not be public/exposed if possible in production
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { sitemapId, userId } = body;

        if (!sitemapId || !userId) {
            return NextResponse.json({ error: "Missing sitemapId or userId" }, { status: 400 });
        }

        await connectDB();

        const sitemap = await Sitemap.findById(sitemapId);
        if (!sitemap) {
            return NextResponse.json({ error: "Sitemap not found" }, { status: 404 });
        }

        // 1. Mark as Processing
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

        // 4. Save Log
        const log = await HealthCheckLog.create({
            userId,
            sitemapId,
            feedpath: sitemap.feedpath,
            status: result.status,
            summary: result.summary,
            errors: result.errors,
            checkedAt: new Date(),
        });

        // 5. Find recipient email from ServiceAccount
        // Use the most recent valid service account's clientEmail
        const serviceAccount = await ServiceAccount.findOne({ userId, isValid: true }).sort({ createdAt: -1 });

        if (serviceAccount && serviceAccount.clientEmail) {
            await sendHealthCheckEmail({
                to: serviceAccount.clientEmail,
                sitemapUrl: sitemap.feedpath,
                status: result.status,
                summary: result.summary,
                errors: result.errors,
            });
        } else {
            console.warn(`No email recipient found for health check report (User: ${userId})`);
        }

        return NextResponse.json({ success: true, logId: log._id });

    } catch (error) {
        console.error("Health Check Task Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
