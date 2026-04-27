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

        const { orchestrateSitemapHealthCheck } = require("@/lib/sitemap-service");

        const result = await orchestrateSitemapHealthCheck(sitemapId, userId, {
            force,
            skipEmail: false // Existing task triggers (from manual submission) should still report
        });

        return NextResponse.json({ success: true, logId: result.logId });

    } catch (error) {
        console.error("Health Check Task Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
