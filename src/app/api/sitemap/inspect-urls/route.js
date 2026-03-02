import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { google } from "googleapis";
import { decrypt } from "@/lib/encryption";
import connectDB from "@/lib/db";
import ServiceAccount from "@/models/ServiceAccount";

export const dynamic = "force-dynamic";

async function checkIndexingBatch(urls, siteUrl, accounts) {
    const results = [];

    // Process URLs sequentially to avoid hitting GSC API rate limits too hard per account
    for (const url of urls) {
        let inspection = { verdict: "UNKNOWN", indexStatus: "UNCHECKED" };

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

                await jwtClient.authorize();
                const searchConsole = google.searchconsole({ version: "v1", auth: jwtClient });

                const res = await searchConsole.urlInspection.index.inspect({
                    requestBody: {
                        inspectionUrl: url,
                        siteUrl: siteUrl.trim(),
                    },
                });

                const verdict = res.data.inspectionResult?.indexStatusResult?.verdict || "NEUTRAL";
                inspection = {
                    verdict,
                    indexStatus: verdict === "PASS" ? "INDEXED" : "NOT_INDEXED",
                    coverageState: res.data.inspectionResult?.indexStatusResult?.coverageState || null
                };
                break; // Found an account that works

            } catch (err) {
                // If 403, this account lacks permission, try next one
                if (err.message.includes("403")) continue;
                // Other error (quota, etc.), we stop searching for this URL
                break;
            }
        }
        results.push({ url, inspection });
    }
    return results;
}

export async function POST(request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { urls: bodyUrls, siteUrl, feedpath, fetchOnly } = body;

        let urlsToInspect = bodyUrls || [];

        // If no URLs provided but feedpath is, fetch and parse the sitemap
        if (urlsToInspect.length === 0 && feedpath) {
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 10000);
                const res = await fetch(feedpath, {
                    headers: { "User-Agent": "Mozilla/5.0 (compatible; SitemapChecker/1.0)" },
                    signal: controller.signal,
                });
                clearTimeout(timer);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const xmlText = await res.text();
                const locRegex = /<loc[^>]*>([\s\S]*?)<\/loc>/gi;
                let match;
                while ((match = locRegex.exec(xmlText)) !== null) {
                    const url = match[1].trim().replace(/&amp;/g, "&");
                    if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
                        urlsToInspect.push(url);
                    }
                }
                // Limit to 200 URLs for safety
                urlsToInspect = urlsToInspect.slice(0, 200);
            } catch (err) {
                return NextResponse.json({ error: `Could not fetch sitemap: ${err.message}` }, { status: 502 });
            }
        }

        if (urlsToInspect.length === 0 || (!siteUrl && !fetchOnly)) {
            return NextResponse.json({ error: "URLs (or feedpath) and siteUrl are required" }, { status: 400 });
        }

        // If fetchOnly, return the URLs immediately
        if (fetchOnly) {
            return NextResponse.json({
                urls: urlsToInspect,
                summary: {
                    total: urlsToInspect.length,
                    indexed: 0,
                    nonIndexed: 0
                }
            });
        }

        await connectDB();
        const accounts = await ServiceAccount.find({ userId: session.user.id, isValid: true });

        if (accounts.length === 0) {
            return NextResponse.json({ error: "No valid service accounts found" }, { status: 404 });
        }

        const results = await checkIndexingBatch(urlsToInspect, siteUrl, accounts);

        return NextResponse.json({
            results,
            summary: {
                total: results.length,
                indexed: results.filter(r => r.inspection.indexStatus === "INDEXED").length,
                nonIndexed: results.filter(r => r.inspection.indexStatus === "NOT_INDEXED").length
            }
        });

    } catch (error) {
        console.error("Indexing Inspect API Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}
