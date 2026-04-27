import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import SitemapLog from "@/models/SitemapLog";

export const dynamic = "force-dynamic";

export async function GET(request) {
    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        const category = searchParams.get("category") || "sitemap"; // "sitemap" | "reporting" | "system"

        // Filter by category; fall back to showing all uncategorised logs as sitemap logs
        const query = category === "reporting"
            ? { logCategory: "reporting" }
            : category === "system"
                ? { logCategory: "system" }
                : { $or: [{ logCategory: "sitemap" }, { logCategory: { $exists: false } }] };

        const logs = await SitemapLog.find(query)
            .sort({ timestamp: -1 })
            .limit(20);

        return NextResponse.json({ success: true, logs, category });
    } catch (error) {
        console.error("[LOGS-API] Error fetching logs:", error);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
