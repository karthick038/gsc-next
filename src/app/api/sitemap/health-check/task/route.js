import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Sitemap from "@/models/Sitemap";
import HealthCheckLog from "@/models/HealthCheckLog";
import ServiceAccount from "@/models/ServiceAccount";
import User from "@/models/User";
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
            errorLogs: result.errors,
            checkedAt: new Date(),
        });

        // 5. Find recipient email
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

        if (recipientEmail && result.status !== "SUCCESS") {
            console.log(`Sending health check report to: ${recipientEmail} for sitemap: ${sitemap.feedpath}`);
            await sendHealthCheckEmail({
                to: recipientEmail,
                sitemapUrl: sitemap.feedpath,
                status: result.status,
                summary: result.summary,
                errorLogs: result.errors,
            });
        } else if (!recipientEmail) {
            console.warn(`No email recipient found for health check report (User: ${userId})`);
        }

        return NextResponse.json({ success: true, logId: log._id });

    } catch (error) {
        console.error("Health Check Task Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
