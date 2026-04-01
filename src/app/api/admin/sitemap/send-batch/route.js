import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/db";
import SitemapBatchQueue from "@/models/SitemapBatchQueue";
import Settings from "@/models/Settings";
 

export async function POST() {
    try {
        const session = await auth();
        if (session?.user?.role?.toLowerCase() !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { sendBatchDispatch } = require("@/lib/sitemap-service");
        const result = await sendBatchDispatch(session.user.email);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ 
            success: true, 
            message: result.summary,
            sentAt: result.sentAt
        });
    } catch (error) {
        console.error("Batch Email Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
