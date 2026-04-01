import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/db";
import SitemapBatchQueue from "@/models/SitemapBatchQueue";

export async function DELETE(request, { params }) {
    try {
        const session = await auth();
        if (session?.user?.role?.toLowerCase() !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: "Missing ID" }, { status: 400 });
        }

        await connectDB();
        const deleted = await SitemapBatchQueue.findByIdAndDelete(id);

        if (!deleted) {
            return NextResponse.json({ error: "Item not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: "Sitemap removed from queue successfully." });
    } catch (error) {
        console.error("Queue Delete Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
