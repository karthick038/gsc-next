import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/db";
import WebsiteQuota from "@/models/WebsiteQuota";
import { normalizeWebsite, getTodayDate } from "@/lib/utils";

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const website = searchParams.get("website");

        if (!website) {
            return NextResponse.json({ error: "Website URL is required" }, { status: 400 });
        }

        const normalizedWebsite = normalizeWebsite(website);

        await connectDB();

        const today = getTodayDate();
        const userId = session.user.id;

        // Atomic search-and-create to prevent race conditions (E11000)
        let quota;
        try {
            quota = await WebsiteQuota.findOneAndUpdate(
                { website: normalizedWebsite, date: today, userId },
                {
                    $setOnInsert: {
                        used: 0,
                        limit: 200
                    }
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true
                }
            );
        } catch (e) {
            if (e.code === 11000) {
                quota = await WebsiteQuota.findOne({ website: normalizedWebsite, date: today, userId });
            } else {
                throw e;
            }
        }

        return NextResponse.json({
            used: quota.used,
            limit: quota.limit,
            remaining: Math.max(0, quota.limit - quota.used),
            website: quota.website
        });

    } catch (error) {
        console.error("Quota Fetch Error:", error);
        return NextResponse.json({ error: "Failed to fetch quota" }, { status: 500 });
    }
}
