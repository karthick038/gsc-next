import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/db";
import ServiceAccount from "@/models/ServiceAccount";
import { google } from "googleapis";
import { decrypt } from "@/lib/encryption";

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
                return NextResponse.json({
                    success: true,
                    message: `Sitemap "${feedpath}" submitted successfully to ${siteUrl}.`,
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
