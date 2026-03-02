import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function POST(request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { sitemapUrl, siteUrl } = body;

        if (!sitemapUrl) {
            return NextResponse.json({ error: "sitemapUrl is required." }, { status: 400 });
        }

        const errors = [];
        const warnings = [];

        // --- Step 1: URL Format Validation ---
        let parsedUrl;
        try {
            parsedUrl = new URL(sitemapUrl);
            if (!["http:", "https:"].includes(parsedUrl.protocol)) {
                errors.push("Sitemap URL must use http:// or https:// protocol.");
            }
        } catch {
            errors.push("Sitemap URL is not a valid URL. Please enter a full URL including https://");
            return NextResponse.json({ valid: false, errors, warnings });
        }

        // --- Step 2: Domain match check (if siteUrl provided) ---
        if (siteUrl) {
            try {
                const siteHostname = new URL(siteUrl).hostname.toLowerCase().replace(/^www\./, "");
                const sitemapHostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
                if (sitemapHostname !== siteHostname) {
                    errors.push(
                        `Sitemap URL domain (${sitemapHostname}) does not match the selected property (${siteHostname}).`
                    );
                }
            } catch {
                // ignore parse error for siteUrl
            }
        }

        // Return early if URL is already invalid (no point fetching)
        if (errors.length > 0) {
            return NextResponse.json({ valid: false, errors, warnings });
        }

        // --- Step 3: Reachability Check ---
        let xmlContent = "";
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const fetchRes = await fetch(sitemapUrl, {
                signal: controller.signal,
                headers: {
                    "User-Agent": "GSCDashboard-Validator/1.0",
                },
            });
            clearTimeout(timeout);

            if (!fetchRes.ok) {
                errors.push(
                    `Sitemap URL returned HTTP ${fetchRes.status}. It must return HTTP 200.`
                );
                return NextResponse.json({ valid: false, errors, warnings });
            }

            const contentType = fetchRes.headers.get("content-type") || "";
            if (!contentType.includes("xml") && !contentType.includes("text")) {
                warnings.push(
                    `Unexpected Content-Type: "${contentType}". Sitemaps should return application/xml or text/xml.`
                );
            }

            xmlContent = await fetchRes.text();
        } catch (fetchErr) {
            if (fetchErr.name === "AbortError") {
                errors.push("Sitemap URL timed out after 10 seconds. Ensure the URL is publicly accessible.");
            } else {
                errors.push(`Could not reach sitemap URL: ${fetchErr.message}`);
            }
            return NextResponse.json({ valid: false, errors, warnings });
        }

        // --- Step 4: XML Structure Validation ---
        if (!xmlContent.trim()) {
            errors.push("Sitemap file is empty.");
            return NextResponse.json({ valid: false, errors, warnings });
        }

        // Check for root element
        const hasUrlset = xmlContent.includes("<urlset") || xmlContent.includes("<Urlset");
        const hasSitemapIndex = xmlContent.includes("<sitemapindex") || xmlContent.includes("<SitemapIndex");

        if (!hasUrlset && !hasSitemapIndex) {
            errors.push(
                "Sitemap XML is missing the required root element (<urlset> or <sitemapindex>)."
            );
        }

        if (!xmlContent.includes("</loc>") && !xmlContent.includes("<loc/>")) {
            if (hasUrlset) {
                errors.push("Sitemap is missing <loc> elements. Every <url> entry must have a <loc> tag.");
            }
        }

        // Extract all <loc> values using regex
        const locMatches = [...xmlContent.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)];
        const locUrls = locMatches.map((m) => m[1].trim());

        if (hasUrlset && locUrls.length === 0) {
            errors.push("No URLs found in sitemap. Add at least one <url><loc>...</loc></url> entry.");
        }

        // Check for duplicate URLs
        const urlSet = new Set();
        const duplicates = [];
        for (const url of locUrls) {
            if (urlSet.has(url)) {
                duplicates.push(url);
            }
            urlSet.add(url);
        }
        if (duplicates.length > 0) {
            warnings.push(
                `Found ${duplicates.length} duplicate URL(s) in sitemap. Duplicates will be ignored by Google.`
            );
        }

        // Validate individual URL formats
        const invalidLocUrls = locUrls.filter((url) => {
            try {
                new URL(url);
                return false;
            } catch {
                return true;
            }
        });
        if (invalidLocUrls.length > 0) {
            errors.push(
                `Found ${invalidLocUrls.length} invalid URL format(s) in <loc> elements. All URLs must be absolute.`
            );
        }

        // Check sitemap size limits
        const xmlSizeBytes = Buffer.byteLength(xmlContent, "utf8");
        if (xmlSizeBytes > 50 * 1024 * 1024) {
            errors.push("Sitemap file exceeds the 50MB limit. Split into multiple sitemaps.");
        }
        if (locUrls.length > 50000) {
            errors.push(
                `Sitemap contains ${locUrls.length} URLs which exceeds the 50,000 URL limit per sitemap file.`
            );
        }

        const valid = errors.length === 0;

        return NextResponse.json({
            valid,
            errors,
            warnings,
            stats: {
                totalUrls: locUrls.length,
                duplicates: duplicates.length,
                fileSizeKB: Math.round(xmlSizeBytes / 1024),
                isSitemapsIndex: hasSitemapIndex,
            },
        });
    } catch (error) {
        console.error("Sitemap Validate API Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}
