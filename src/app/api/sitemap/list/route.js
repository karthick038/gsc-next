import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/db";
import ServiceAccount from "@/models/ServiceAccount";
import { google } from "googleapis";
import { decrypt } from "@/lib/encryption";
import Sitemap from "@/models/Sitemap";

export const dynamic = "force-dynamic";

export async function GET(request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const siteUrl = searchParams.get("siteUrl");

        if (!siteUrl) {
            return NextResponse.json({ error: "siteUrl is required" }, { status: 400 });
        }

        await connectDB();
        const accounts = await ServiceAccount.find({ userId: session.user.id, isValid: true });

        if (!accounts.length) {
            return NextResponse.json({ error: "No valid service accounts found." }, { status: 403 });
        }

        // Encode siteUrl for the API path
        const encodedSiteUrl = encodeURIComponent(siteUrl);
        const apiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/sitemaps`;

        // Try each service account directly against the sitemap API
        // (avoids an extra sites.list() round-trip that can fail silently)
        let lastError = "No valid service account found for this property.";

        for (const acc of accounts) {
            try {
                const decryptedText = decrypt(acc.encryptedJson);
                if (!decryptedText) continue;
                const creds = JSON.parse(decryptedText);

                const jwtClient = new google.auth.JWT({
                    email: creds.client_email,
                    key: creds.private_key,
                    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
                });

                const tokens = await jwtClient.authorize();
                const accessToken = tokens.access_token;

                const res = await fetch(apiUrl, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                });

                // 403 = this account has no permission for this property; try next
                if (res.status === 403) {
                    // lastError = "Insufficient permissions to access sitemap data for this property.";
                    // continue;
                    const errText = await res.text();
                    lastError = `GSC API Error ${res.status}: ${errText}`;
                    continue;
                }

                if (res.status === 429) {
                    return NextResponse.json(
                        { error: "Google API quota exceeded. Please try again later." },
                        { status: 429 }
                    );
                }

                if (!res.ok) {
                    const errText = await res.text();
                    lastError = `GSC API Error ${res.status}: ${errText}`;
                    continue;
                }

                // Success — parse and return enriched sitemaps
                const data = await res.json();
                const sitemaps = data.sitemap || [];

                // Fetch local health data
                const localSitemaps = await Sitemap.find({ userId: session.user.id, siteUrl });

                // Fetch latest logs to get emailResponse
                const latestLogs = await HealthCheckLog.find({
                    userId: session.user.id,
                    sitemapId: { $in: localSitemaps.map(ls => ls._id) }
                }).sort({ checkedAt: -1 });

                const enriched = sitemaps.map((sm) => {
                    const contents = sm.contents || [];

                    // Find local data for this sitemap
                    const localData = localSitemaps.find(ls => ls.feedpath === sm.path);
                    const latestLog = latestLogs.find(log => log.sitemapId.toString() === localData?._id?.toString());

                    // Find the 'web' content type — this is what GSC dashboard counts as "Discovered"
                    const webContent = contents.find((c) => c.type === "web");
                    const webSubmitted = parseInt(webContent?.submitted || 0);
                    const webIndexed = parseInt(webContent?.indexed || 0);

                    // Total across ALL content types (image, video, news, web)
                    const totalSubmitted = contents.reduce(
                        (acc, c) => acc + (parseInt(c.submitted) || 0), 0
                    );
                    const totalIndexed = contents.reduce(
                        (acc, c) => acc + (parseInt(c.indexed) || 0), 0
                    );

                    const errors = sm.errors ? parseInt(sm.errors) : 0;
                    const warnings = sm.warnings ? parseInt(sm.warnings) : 0;

                    let statusLabel = "Success";
                    if (sm.isPending) statusLabel = "Pending";
                    else if (errors > 0) statusLabel = "Has Errors";
                    else if (warnings > 0) statusLabel = "Has Warnings";

                    return {
                        path: sm.path,
                        lastSubmitted: sm.lastSubmitted || null,
                        lastDownloaded: sm.lastDownloaded || null,
                        isPending: sm.isPending || false,
                        isSitemapsIndex: sm.isSitemapsIndex || sm.type === "INDEX" || sm.type === "sitemapsIndex" || false,
                        errors,
                        warnings,
                        statusLabel,
                        webSubmitted,
                        webIndexed,
                        totalSubmitted,
                        totalIndexed,
                        contents,
                        // --- New Health Check Fields ---
                        healthStatus: localData?.status || "PENDING",
                        lastHealthCheckAt: localData?.lastCheckedAt || null,
                        localErrorCount: localData?.errorCount || 0,
                        accountEmail: localData?.accountEmail || null,
                        emailResponse: latestLog?.emailResponse || null,
                    };
                });

                // --- Trigger background health check for PENDING sitemaps ---
                const protocol = request.headers.get("x-forwarded-proto") || "http";
                const host = request.headers.get("host");
                const baseUrl = `${protocol}://${host}`;

                enriched.forEach(sm => {
                    // Only auto-trigger if it has NEVER been checked (no local record or no lastCheckedAt)
                    const localSm = localSitemaps.find(ls => ls.feedpath === sm.path);
                    if (!localSm || !localSm.lastCheckedAt) {
                        console.log(`[LIST] Auto-triggering FIRST health check for: ${sm.path}`);

                        // We need an ID to trigger the task. If local record doesn't exist, we might need a different approach or just wait for first submit.
                        // But usually sitemaps are discovered from GSC and might not be in our DB yet.
                        // Let's ensure they exist in DB first or ignore if they aren't "ours" yet.
                        if (localSm) {
                            fetch(`${baseUrl}/api/sitemap/health-check/task`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    sitemapId: localSm._id,
                                    userId: session.user.id
                                }),
                            }).catch(err => console.error("Auto-trigger failed:", err));
                        }
                    }
                });

                return NextResponse.json({ sitemaps: enriched });

            } catch (err) {
                console.error(`Sitemap list: account attempt failed (${acc.filename}):`, err.message);
                lastError = err.message;
            }
        }

        // All accounts tried and failed
        return NextResponse.json({ error: lastError }, { status: 403 });

    } catch (error) {
        console.error("Sitemap List API Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}
