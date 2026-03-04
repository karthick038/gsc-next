import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/db";
import ServiceAccount from "@/models/ServiceAccount";
import { google } from "googleapis";
import { decrypt } from "@/lib/encryption";
import Sitemap from "@/models/Sitemap";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function POST(request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { siteUrl, feedpath } = body;

        if (!siteUrl || !feedpath) {
            return NextResponse.json(
                { error: "Both siteUrl and feedpath (sitemap URL) are required." },
                { status: 400 }
            );
        }

        // Validate feedpath is a proper URL
        try {
            new URL(feedpath);
        } catch {
            return NextResponse.json(
                { error: "feedpath must be a valid absolute URL." },
                { status: 400 }
            );
        }

        await connectDB();
        const accounts = await ServiceAccount.find({ userId: session.user.id, isValid: true });

        if (!accounts.length) {
            return NextResponse.json({ error: "No valid service accounts found." }, { status: 403 });
        }

        const encodedSiteUrl = encodeURIComponent(siteUrl);
        const encodedFeedpath = encodeURIComponent(feedpath);
        const apiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/sitemaps/${encodedFeedpath}`;

        // Try each service account directly against the sitemap submit API
        let lastError = "No valid service account found for this property.";

        for (const acc of accounts) {
            try {
                const decryptedText = decrypt(acc.encryptedJson);
                if (!decryptedText) continue;
                const creds = JSON.parse(decryptedText);

                // Full webmasters scope required for PUT (submission)
                const jwtClient = new google.auth.JWT({
                    email: creds.client_email,
                    key: creds.private_key,
                    scopes: ["https://www.googleapis.com/auth/webmasters"],
                });

                const tokens = await jwtClient.authorize();
                const accessToken = tokens.access_token;

                const res = await fetch(apiUrl, {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                });

                // 403 = this account has no permission for this property; try next
                if (res.status === 403) {
                    lastError = "Permission denied. The service account must have Owner or Full access to submit sitemaps.";
                    continue;
                }

                if (res.status === 401) {
                    lastError = "Authentication failed. Token may have expired.";
                    continue;
                }

                if (res.status === 429) {
                    return NextResponse.json(
                        { error: "Google API quota exceeded. Please try again later." },
                        { status: 429 }
                    );
                }

                if (!res.ok) {
                    let errMsg = `GSC API Error ${res.status}`;
                    try {
                        const errData = await res.json();
                        errMsg = errData?.error?.message || errMsg;
                    } catch {
                        errMsg = (await res.text()) || errMsg;
                    }
                    lastError = errMsg;
                    continue;
                }

                // Successful PUT returns 204 No Content

                // --- Get Correct Recipient Email for JSON attribution ---
                const user = await User.findById(session.user.id);
                let recipientEmail = user?.email;

                if (user && user.verifiedSites) {
                    const siteMatch = user.verifiedSites.find(vs => {
                        const normalizedVs = vs.url.toLowerCase().replace(/\/$/, "").replace(/^https?:\/\//, "").replace(/^www\./, "");
                        const normalizedTarget = siteUrl.toLowerCase().replace(/\/$/, "").replace(/^https?:\/\//, "").replace(/^www\./, "");
                        return normalizedVs === normalizedTarget;
                    });
                    if (siteMatch?.accountEmail) {
                        recipientEmail = siteMatch.accountEmail;
                    }
                }

                const sitemapRecord = await Sitemap.findOneAndUpdate(
                    { userId: session.user.id, siteUrl, feedpath },
                    {
                        status: "PROCESSING",
                        lastCheckedAt: new Date(),
                        isDeleted: false,
                        accountEmail: recipientEmail // Store for notifications
                    },
                    { upsert: true, new: true }
                );

                // --- Trigger Background Health Check (Non-blocking) ---
                const protocol = request.headers.get("x-forwarded-proto") || "http";
                const host = request.headers.get("host");
                const baseUrl = `${protocol}://${host}`;

                // Use fetch to trigger the task without awaiting its full completion
                fetch(`${baseUrl}/api/sitemap/health-check/task`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sitemapId: sitemapRecord._id,
                        userId: session.user.id
                    }),
                }).catch(err => console.error("Background task trigger failed:", err));

                return NextResponse.json({
                    success: true,
                    message: `Sitemap submitted successfully. Sitemap reports send to ${recipientEmail || acc.clientEmail}`,
                });

            } catch (err) {
                console.error(`Sitemap submit: account attempt failed (${acc.filename}):`, err.message);
                lastError = err.message;
            }
        }

        // All accounts tried and failed
        return NextResponse.json({ error: lastError }, { status: 403 });

    } catch (error) {
        console.error("Sitemap Submit API Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}
