import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/db";
import Submission from "@/models/Submission";
import mongoose from "mongoose";

export async function GET(request) {
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role?.toLowerCase();
        const isAdmin = role === "admin";
        const { searchParams } = new URL(request.url);
        const queryUserId = searchParams.get("userId")?.trim();

        // Target User logic
        let targetUserObjectId = null;
        if (isAdmin) {
            targetUserObjectId = queryUserId ? new mongoose.Types.ObjectId(queryUserId) : null;
        } else {
            targetUserObjectId = new mongoose.Types.ObjectId(session.user.id);
        }

        const page = parseInt((searchParams.get("page") || "1").trim(), 10);
        let limitValueRaw = searchParams.get("limit")?.trim();
        let limitValue = 30;

        if (limitValueRaw === 'All') {
            limitValue = 10000;
        } else if (limitValueRaw) {
            limitValue = parseInt(limitValueRaw, 10);
        }

        const skip = (page - 1) * limitValue;

        const dateParam = searchParams.get("date")?.trim(); // YYYY-MM-DD
        const actionParam = searchParams.get("action")?.trim();
        const statusCodeParam = searchParams.get("statusCode")?.trim();
        const websiteParam = searchParams.get("website")?.trim();

        await connectDB();

        // 1. Core Filter
        const andFilters = [];
        if (targetUserObjectId) {
            andFilters.push({ userId: targetUserObjectId });
        }

        // 2. Date Filter (Triple-layer fallback with IST-aligned range)
        if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
            const dateObj = new Date(dateParam + "T00:00:00Z");
            const start = new Date(dateObj.getTime() - (5.5 * 60 * 60 * 1000)); // Shift for IST
            const end = new Date(start.getTime() + (24 * 60 * 60 * 1000) - 1);

            andFilters.push({
                $or: [
                    { submittedAt: { $gte: start, $lte: end } },
                    { createdAt: { $gte: start, $lte: end } }
                ]
            });
        }

        // 3. Action Filter (Normalized labels)
        if (actionParam && actionParam !== "All") {
            andFilters.push({ action: actionParam });
        }

        // 4. Status Filter
        if (statusCodeParam && statusCodeParam !== "All") {
            andFilters.push({ statusCode: parseInt(statusCodeParam) });
        }

        // 5. Website Filter (Prefix matching)
        if (websiteParam && websiteParam !== "All") {
            andFilters.push({ url: { $regex: "^" + websiteParam } });
        }

        const query = andFilters.length > 0 ? { $and: andFilters } : {};

        // 6. Dynamic Filter Options - For Super Admins, show options across all users they are currently filtering
        const metadataFilter = {};
        if (targetUserObjectId) {
            metadataFilter.userId = targetUserObjectId;
        } else if (!isAdmin) {
            // Normal user or non-admin should always be restricted to their own userId
            metadataFilter.userId = new mongoose.Types.ObjectId(session.user.id);
        }

        const distinctStatusCodes = await Submission.distinct('statusCode', metadataFilter);

        // Fetch display URLs for website filter mapping
        const allUrls = await Submission.distinct('url', metadataFilter);
        const distinctWebsites = [...new Set(allUrls.map(url => {
            try {
                const u = new URL(url);
                return `${u.protocol}//${u.hostname}/`;
            } catch (e) { return null; }
        }))].filter(Boolean).sort();

        // 7. Fetch Data
        const totalCount = await Submission.countDocuments(query);
        const totalPages = Math.ceil(totalCount / limitValue) || 1;

        const submissions = await Submission.find(query)
            .sort({ submittedAt: -1, createdAt: -1 })
            .skip(skip)
            .limit(limitValue)
            .lean();

        return NextResponse.json({
            history: submissions,
            distinctStatusCodes: distinctStatusCodes.sort((a, b) => a - b),
            distinctWebsites,
            pagination: {
                totalCount,
                totalPages,
                currentPage: page,
                limit: limitValue === 10000 ? 'All' : limitValue
            }
        }, { status: 200 });

    } catch (error) {
        console.error("History API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
