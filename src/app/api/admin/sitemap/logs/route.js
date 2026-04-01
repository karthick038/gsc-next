import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import SitemapLog from "@/models/SitemapLog";

export async function GET() {
    try {
        await connectDB();
        const logs = await SitemapLog.find({})
            .sort({ timestamp: -1 })
            .limit(20);

        return NextResponse.json({ success: true, logs });
    } catch (error) {
        console.error("[LOGS-API] Error fetching logs:", error);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
