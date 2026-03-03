import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/db";
import User from "@/models/User";

export async function GET() {
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();
        const user = await User.findById(session.user.id).select("email siteUrls verifiedSites indexingStatus lastConnectionTestAt connectedSitesCount sitesWithPermission sitesWithoutPermission");

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        console.log("DEBUG verifiedSites from DB:", JSON.stringify(user.verifiedSites, null, 2));

        return NextResponse.json({
            email: user.email,
            siteUrls: user.siteUrls || [],
            verifiedSites: user.verifiedSites || [],
            indexingStatus: user.indexingStatus || "NOT_VERIFIED",
            lastConnectionTestAt: user.lastConnectionTestAt,
            connectedSitesCount: user.connectedSitesCount || 0,
            sitesWithPermission: user.sitesWithPermission || 0,
            sitesWithoutPermission: user.sitesWithoutPermission || 0
        });

    } catch (error) {
        console.error("GET Sites Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { url } = await request.json();
        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        await connectDB();
        const user = await User.findById(session.user.id);

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Remove from siteUrls
        user.siteUrls = (user.siteUrls || []).filter(u => u !== url);

        // Remove from verifiedSites
        user.verifiedSites = (user.verifiedSites || []).filter(v => v.url !== url);

        // Update counts
        user.connectedSitesCount = user.verifiedSites.filter(v => v.status === "SUCCESS").length;
        user.sitesWithPermission = user.connectedSitesCount;
        user.sitesWithoutPermission = user.verifiedSites.length - user.connectedSitesCount;

        // Update indexing status if no sites left
        if (user.verifiedSites.length === 0) {
            user.indexingStatus = "DISCONNECTED";
        }

        await user.save();

        return NextResponse.json({
            message: "Site removed successfully",
            verifiedSites: user.verifiedSites,
            indexingStatus: user.indexingStatus
        });

    } catch (error) {
        console.error("DELETE Site Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
