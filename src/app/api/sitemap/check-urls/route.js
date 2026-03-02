import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

const PER_URL_TIMEOUT_MS = 5000;
const MAX_CONCURRENT = 15;
const MAX_URLS = 200;

async function checkUrl(url) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), PER_URL_TIMEOUT_MS);

        const res = await fetch(url, {
            method: "HEAD",
            redirect: "manual", // Don't follow — detect redirects
            signal: controller.signal,
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; SitemapChecker/1.0)",
            },
        });
        clearTimeout(timer);

        const status = res.status;
        const location = res.headers.get("location") || null;

        let category = "ok";
        if (status >= 300 && status < 400) category = "redirect";
        else if (status === 404) category = "not_found";
        else if (status >= 400) category = "error";
        else if (status >= 500) category = "server_error";

        return {
            url,
            status,
            statusText: statusLabel(status),
            rawResponse: category === "redirect" ? `Redirect to: ${location}` : statusLabel(status),
            category,
            redirectUrl: category === "redirect" ? location : null,
        };
    } catch (err) {
        return {
            url,
            status: null,
            statusText: err.name === "AbortError" ? "Timeout" : "Connection Failed",
            rawResponse: err.message || "Unknown Connection Error",
            category: "error",
            redirectUrl: null,
        };
    }
}

function statusLabel(status) {
    const labels = {
        200: "OK",
        301: "Moved Permanently",
        302: "Found (Redirect)",
        303: "See Other",
        307: "Temporary Redirect",
        308: "Permanent Redirect",
        400: "Bad Request",
        401: "Unauthorized",
        403: "Forbidden",
        404: "Not Found",
        410: "Gone",
        429: "Too Many Requests",
        500: "Server Error",
        502: "Bad Gateway",
        503: "Service Unavailable",
    };
    return labels[status] || (status ? String(status) : "Unknown");
}

async function checkBatch(urls) {
    const results = await Promise.allSettled(urls.map((url) => checkUrl(url)));
    return results.map((r, i) =>
        r.status === "fulfilled"
            ? r.value
            : { url: urls[i], status: null, statusText: "Failed", category: "error", redirectUrl: null }
    );
}

export async function POST(request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { feedpath } = body;

        if (!feedpath) {
            return NextResponse.json({ error: "feedpath is required" }, { status: 400 });
        }

        // Fetch the sitemap XML
        let xmlText = "";
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            const res = await fetch(feedpath, {
                headers: { "User-Agent": "Mozilla/5.0 (compatible; SitemapChecker/1.0)" },
                signal: controller.signal,
            });
            clearTimeout(timer);
            if (!res.ok) {
                return NextResponse.json(
                    { error: `Sitemap not reachable: HTTP ${res.status}` },
                    { status: 502 }
                );
            }
            xmlText = await res.text();
        } catch (err) {
            return NextResponse.json(
                { error: `Could not fetch sitemap: ${err.message}` },
                { status: 502 }
            );
        }

        // Parse all <loc> URLs from the XML
        const locRegex = /<loc[^>]*>([\s\S]*?)<\/loc>/gi;
        const allUrls = [];
        let match;
        while ((match = locRegex.exec(xmlText)) !== null) {
            const url = match[1].trim().replace(/&amp;/g, "&");
            if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
                allUrls.push(url);
            }
        }

        if (allUrls.length === 0) {
            return NextResponse.json({ error: "No URLs found in the sitemap XML." }, { status: 400 });
        }

        const urlsToCheck = allUrls.slice(0, MAX_URLS);
        const checkedUrls = [];

        // Check in concurrent batches
        for (let i = 0; i < urlsToCheck.length; i += MAX_CONCURRENT) {
            const batch = urlsToCheck.slice(i, i + MAX_CONCURRENT);
            const statusResults = await checkBatch(batch);
            checkedUrls.push(...statusResults);
        }

        // Build summary
        const summary = {
            total: allUrls.length,
            checked: checkedUrls.length,
            ok: checkedUrls.filter((u) => u.category === "ok").length,
            redirects: checkedUrls.filter((u) => u.category === "redirect").length,
            notFound: checkedUrls.filter((u) => u.category === "not_found").length,
            errors: checkedUrls.filter((u) => u.category === "error" || u.category === "server_error").length,
        };

        // Sort: errors first, then redirects, then ok
        const sorted = [...checkedUrls].sort((a, b) => {
            const order = { error: 0, server_error: 0, not_found: 1, redirect: 2, ok: 3 };
            return (order[a.category] ?? 4) - (order[b.category] ?? 4);
        });

        return NextResponse.json({ urls: sorted, summary });
    } catch (error) {
        console.error("URL Check API Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}
