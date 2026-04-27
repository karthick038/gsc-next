import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/db";
import ServiceAccount from "@/models/ServiceAccount";
import { google } from "googleapis";
import { decrypt } from "@/lib/encryption";
import Sitemap from "@/models/Sitemap";
import User from "@/models/User";
import Settings from "@/models/Settings";

export const dynamic = "force-dynamic";

export async function POST(request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { siteUrl, feedpath } = body;

        if (!siteUrl || !feedpath) {
            return NextResponse.json(
                { error: "Both siteUrl and feedpath (sitemap URL) are required." },
                { status: 400 }
            );
        }

        // Validate feedpath is a proper URL
        try {
            new URL(feedpath);
        } catch {
            return NextResponse.json(
                { error: "feedpath must be a valid absolute URL." },
                { status: 400 }
            );
        }

        const { submitSitemapInternal } = require("@/lib/sitemap-service");

        const result = await submitSitemapInternal(session.user.id, siteUrl, feedpath, {
            skipEmail: false, // Manual submission SHOULD send emails/batch
            forceHealthCheck: true
        });

        return NextResponse.json({
            success: true,
            message: result.message
        });

    } catch (error) {
        console.error("Sitemap Submit API Error:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
