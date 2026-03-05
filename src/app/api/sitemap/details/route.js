import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/db";
import ServiceAccount from "@/models/ServiceAccount";
import { google } from "googleapis";
import { decrypt } from "@/lib/encryption";

export const dynamic = "force-dynamic";

// Known GSC sitemap error codes with descriptions and suggested fixes
const ERROR_DESCRIPTIONS = {
    "sitemap-not-fetched": {
        description: "Google could not download your sitemap.",
        fix: "Ensure the sitemap URL is publicly accessible and returns HTTP 200.",
    },
    "sitemap-http-error": {
        description: "The sitemap URL returned an HTTP error.",
        fix: "Check your server configuration and make sure the sitemap URL is reachable.",
    },
    "sitemap-parse-error": {
        description: "Google could not parse your sitemap XML.",
        fix: "Validate your sitemap XML using an online XML validator and ensure it follows the sitemap protocol.",
    },
    "sitemap-empty": {
        description: "Your sitemap file is empty.",
        fix: "Add URLs to your sitemap and resubmit.",
    },
    "sitemap-missing-loc": {
        description: "One or more <url> entries are missing the required <loc> tag.",
        fix: "Ensure every <url> element in your sitemap contains a valid <loc> element.",
    },
    "sitemap-url-too-long": {
        description: "One or more URLs in your sitemap exceed 2048 characters.",
        fix: "Shorten the URLs or remove them from the sitemap.",
    },
    "sitemap-large-file": {
        description: "The sitemap file exceeds the 50MB limit.",
        fix: "Split your sitemap into multiple smaller sitemaps and create a sitemap index file.",
    },
    "sitemap-too-many-urls": {
        description: "The sitemap contains more than 50,000 URLs.",
        fix: "Split your sitemap into multiple files with max 50,000 URLs each.",
    },
    "sitemap-url-not-reachable": {
        description: "Some URLs listed in the sitemap could not be reached by Google.",
        fix: "Ensure all URLs in the sitemap are publicly accessible and return HTTP 200.",
    },
    "sitemap-redirect": {
        description: "Your sitemap URL redirects to another URL.",
        fix: "Update your sitemap URL to point directly to the final destination without redirects.",
    },
};

function enrichError(errorType) {
    const known = ERROR_DESCRIPTIONS[errorType] || {};
    return {
        type: errorType,
        description: known.description || `Error type: ${errorType}`,
        fix: known.fix || "Check the Google Search Console Help documentation for more details.",
    };
}

export async function GET(request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const siteUrl = searchParams.get("siteUrl");
        const feedpath = searchParams.get("feedpath");

        if (!siteUrl || !feedpath) {
            return NextResponse.json(
                { error: "Both siteUrl and feedpath are required." },
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

        // Try each service account directly against the sitemap details API
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

                // 403 = this account has no permission; try next account
                if (res.status === 403) {
                    lastError = "Insufficient permissions to access sitemap details.";
                    continue;
                }

                if (res.status === 404) {
                    return NextResponse.json(
                        { error: "Sitemap not found. It may have been removed from Google's records." },
                        { status: 404 }
                    );
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

                const data = await res.json();

                const errors = parseInt(data.errors) || 0;
                const warnings = parseInt(data.warnings) || 0;
                const contents = data.contents || [];

                // Build descriptive warning items — try to infer the SPECIFIC warning
                const warningDetails = [];
                if (warnings > 0) {
                    const webContent = contents.find((c) => c.type === "web");
                    const submitted = parseInt(webContent?.submitted || 0);
                    const indexed = parseInt(webContent?.indexed || 0);
                    const gap = submitted - indexed;

                    // Infer the most likely cause based on content analysis
                    if (gap > 0 && submitted > 0) {
                        // Most common GSC warning: URLs in sitemap aren't getting indexed
                        warningDetails.push({
                            type: "Non-Indexed URLs Detected",
                            count: gap,
                            description: `${gap} of ${submitted} URL(s) submitted in this sitemap are not indexed by Google. This typically means some URLs redirect to canonical versions, return soft 404s, or are blocked by robots.txt.`,
                            fix: "Check these URLs in Google Search Console → URL Inspection tool. Ensure each URL in the sitemap is the final canonical version (no redirects), returns proper content (no thin/empty pages), and is not blocked by robots.txt.",
                        });
                    } else if (submitted === 0 && indexed === 0) {
                        warningDetails.push({
                            type: "Sitemap Not Yet Processed",
                            count: null,
                            description: `Google has not yet processed the URLs in this sitemap. This may indicate the sitemap was recently submitted or Google encountered an issue during crawling.`,
                            fix: "Wait for Google to process the sitemap. If this persists, check the sitemap URL is publicly accessible and valid XML.",
                        });
                    } else {
                        // Fallback — we know there's a warning but can't pinpoint it
                        warningDetails.push({
                            type: `${warnings} Warning${warnings !== 1 ? "s" : ""} Reported by Google`,
                            count: warnings,
                            description: `Google Search Console flagged ${warnings} warning${warnings !== 1 ? "s" : ""} for this sitemap. The exact cause is not available through the API — common reasons include non-canonical URLs, soft 404s, or robots.txt blocks.`,
                            fix: "Open Google Search Console directly to see the specific warning. Click 'View in Search Console' above for the exact details.",
                        });
                    }
                }

                // Build descriptive error items
                const errorDetails = [];
                if (errors > 0) {
                    errorDetails.push({
                        type: "URL Not Found (404)",
                        count: errors,
                        description: `${errors} URL(s) in the sitemap returned a 404 Not Found response when Google tried to crawl them.`,
                        fix: "Remove deleted URLs from the sitemap, or redirect them to working pages with 301 redirects.",
                    });
                    errorDetails.push({
                        type: "Fetch / Crawl Error",
                        count: null,
                        description: "Google could not download or parse one or more URLs. This may be due to server errors (5xx), connection timeouts, or malformed XML.",
                        fix: "Check your server logs for 5xx errors. Ensure the sitemap XML is valid and the server responds within timeout limits.",
                    });
                }

                // GSC deeplink to the sitemap detail page
                const gscUrl = `https://search.google.com/search-console/sitemaps?resource_id=${encodeURIComponent(siteUrl)}`;

                return NextResponse.json({
                    path: data.path,
                    lastSubmitted: data.lastSubmitted || null,
                    lastDownloaded: data.lastDownloaded || null,
                    isPending: data.isPending || false,
                    isSitemapsIndex: data.isSitemapsIndex || data.type === "INDEX" || data.type === "sitemapsIndex" || false,
                    errors,
                    warnings,
                    contents,
                    errorDetails,
                    warningDetails,
                    gscUrl,
                });

            } catch (err) {
                console.error(`Sitemap details: account attempt failed (${acc.filename}):`, err.message);
                lastError = err.message;
            }
        }

        // All accounts tried and failed
        return NextResponse.json({ error: lastError }, { status: 403 });

    } catch (error) {
        console.error("Sitemap Details API Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}
