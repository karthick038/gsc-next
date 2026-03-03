import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/db";
import HealthCheckLog from "@/models/HealthCheckLog";

export const dynamic = "force-dynamic";

export async function GET(request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const sitemapId = searchParams.get("sitemapId");

        if (!sitemapId) {
            return NextResponse.json({ error: "sitemapId is required" }, { status: 400 });
        }

        await connectDB();

        // Get the latest log for this sitemap
        const log = await HealthCheckLog.findOne({
            userId: session.user.id,
            sitemapId
        }).sort({ checkedAt: -1 });

        if (!log) {
            return NextResponse.json({ error: "No health logs found for this sitemap" }, { status: 404 });
        }

        return NextResponse.json({ log });

    } catch (error) {
        console.error("Health Log API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
