import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/db";
import UserQuota from "@/models/UserQuota";

export async function GET() {
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        const today = new Date().toISOString().split('T')[0];

        await connectDB();

        // Find or create today's quota record
        let quota = await UserQuota.findOne({ userId, date: today });

        if (!quota) {
            quota = await UserQuota.create({
                userId,
                date: today,
                usedCount: 0,
                limit: 200
            });
        }

        return NextResponse.json({
            usedCount: quota.usedCount,
            limit: quota.limit,
            remaining: Math.max(0, quota.limit - quota.usedCount)
        });

    } catch (error) {
        console.error("Quota API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
