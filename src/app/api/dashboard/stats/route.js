import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/db";
import Submission from "@/models/Submission";
import mongoose from "mongoose";

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        await connectDB();

        // 1. Check if user has ANY history (to decide visibility)
        let userQuery = { userId: userId };
        try {
            const userObjectId = new mongoose.Types.ObjectId(userId);
            userQuery = { $or: [{ userId: userId }, { userId: userObjectId }] };
        } catch (e) {
            // userId is not a valid ObjectId string, fallback to string query
        }

        const totalSubmissions = await Submission.countDocuments(userQuery);
        const hasHistory = totalSubmissions > 0;

        if (!hasHistory) {
            return NextResponse.json({ count: 0, totalSubmissions: 0, successRate: "0.0", hasHistory: false });
        }

        // 2. Count submissions for TODAY (IST Aligned)
        // Midnight IST is 18:30 UTC of previous day
        const now = new Date();
        const startOfTodayIST = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
        // Simple heuristic: if it's before 18:30 UTC, "Today" in IST started at 18:30 UTC yesterday.
        // But more robustly, let's just use the history's logic: 
        // We want records from the current calendar day in IST.

        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);
        // Shift by 5.5 hours backwards to get midnight IST in UTC
        startOfToday.setTime(startOfToday.getTime() - (5.5 * 60 * 60 * 1000));

        const todayCount = await Submission.countDocuments({
            $and: [
                userQuery,
                {
                    $or: [
                        { submittedAt: { $gte: startOfToday } },
                        { createdAt: { $gte: startOfToday } }
                    ]
                }
            ]
        });

        // 3. Overall Stats (Success rate based on HTTP 2xx)
        // Re-using totalSubmissions from check above? No, that was just a check.
        // Actually, we can reuse it if we assign it to a const.
        // Wait, line 17: const totalSubmissions = await Submission.countDocuments({ userId });
        // Yes, we already have it.

        const successCount = await Submission.countDocuments({
            $and: [
                userQuery,
                { statusCode: { $gte: 200, $lt: 300 } }
            ]
        });

        const successRate = totalSubmissions > 0
            ? ((successCount / totalSubmissions) * 100).toFixed(1)
            : "0.0";

        return NextResponse.json({
            count: todayCount,
            totalSubmissions,
            successRate,
            hasHistory: true
        });

    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
