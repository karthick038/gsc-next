const PER_URL_TIMEOUT_MS = 10000;
const MAX_CONCURRENT = 10;
const MAX_URLS_PER_SITEMAP = 500;

async function checkUrl(url) {
    const startTime = Date.now();
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), PER_URL_TIMEOUT_MS);

        const res = await fetch(url, {
            method: "HEAD",
            redirect: "manual",
            signal: controller.signal,
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; IndexFastSitemapChecker/1.0)",
            },
        });
        clearTimeout(timer);
        const responseTimeMs = Date.now() - startTime;

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
            responseTimeMs,
            category,
            redirectUrl: location,
        };
    } catch (err) {
        return {
            url,
            status: null,
            statusText: err.name === "AbortError" ? "Timeout" : "Connection Failed",
            responseTimeMs: Date.now() - startTime,
            category: "error",
            errorDetail: err.message,
        };
    }
}

function statusLabel(status) {
    const labels = {
        200: "OK",
        301: "Moved Permanently",
        302: "Found",
        307: "Temporary Redirect",
        308: "Permanent Redirect",
        400: "Bad Request",
        401: "Unauthorized",
        403: "Forbidden",
        404: "Not Found",
        410: "Gone",
        500: "Server Error",
        502: "Bad Gateway",
        503: "Service Unavailable",
    };
    return labels[status] || (status ? `HTTP ${status}` : "Unknown");
}

async function checkBatch(urls) {
    const results = await Promise.allSettled(urls.map((url) => checkUrl(url)));
    return results.map((r, i) =>
        r.status === "fulfilled"
            ? r.value
            : { url: urls[i], status: null, statusText: "Failed", category: "error" }
    );
}

/**
 * Performs a comprehensive health check on a sitemap
 */
export async function performHealthCheck(feedpath) {
    const startTime = Date.now();
    let summary = {
        accessible: false,
        xmlValid: false,
        totalUrls: 0,
        okCount: 0,
        redirectCount: 0,
        errorCount: 0,
        responseTimeMs: 0,
    };
    let errors = [];
    let allUrls = [];

    try {
        // 1. Fetch Sitemap
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(feedpath, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; IndexFastSitemapChecker/1.0)" },
            signal: controller.signal,
        });
        clearTimeout(timer);
        summary.responseTimeMs = Date.now() - startTime;

        if (!res.ok) {
            errors.push({
                url: feedpath,
                type: "Access Error",
                code: res.status,
                description: `Sitemap returned HTTP ${res.status}`,
            });
            return { status: "ERROR", summary, errors };
        }

        summary.accessible = true;
        const xmlText = await res.text();

        // 2. XML Validation (Basic check for start/end tags)
        if (xmlText.trim().startsWith("<?xml") && xmlText.includes("<urlset") || xmlText.includes("<sitemapindex")) {
            summary.xmlValid = true;
        } else {
            errors.push({
                url: feedpath,
                type: "Invalid XML",
                description: "Sitemap does not appear to be a valid XML sitemap.",
            });
            return { status: "ERROR", summary, errors };
        }

        // 3. Parse URLs
        const locRegex = /<loc[^>]*>([\s\S]*?)<\/loc>/gi;
        let match;
        while ((match = locRegex.exec(xmlText)) !== null) {
            const url = match[1].trim().replace(/&amp;/g, "&");
            if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
                allUrls.push(url);
            }
        }

        summary.totalUrls = allUrls.length;
        if (allUrls.length === 0) {
            errors.push({
                url: feedpath,
                type: "Empty Sitemap",
                description: "No URLs found in the sitemap.",
            });
            return { status: "ERROR", summary, errors };
        }

        // 4. Scan URLs (Limit for health check)
        const urlsToScan = allUrls.slice(0, MAX_URLS_PER_SITEMAP);
        let scanResults = [];

        for (let i = 0; i < urlsToScan.length; i += MAX_CONCURRENT) {
            const batch = urlsToScan.slice(i, i + MAX_CONCURRENT);
            const results = await checkBatch(batch);
            scanResults.push(...results);
        }

        // 5. Build Summary & Error List
        summary.okCount = scanResults.filter(r => r.category === "ok").length;
        summary.redirectCount = scanResults.filter(r => r.category === "redirect").length;

        const scanErrors = scanResults.filter(r => r.category !== "ok");
        summary.errorCount = scanErrors.length;

        // Populate error details for the email/log
        scanErrors.forEach(err => {
            errors.push({
                url: err.url,
                type: err.statusText,
                code: err.status,
                description: err.errorDetail || (err.category === "redirect" ? `Redirect to ${err.redirectUrl}` : "Unknown error"),
            });
        });

        // Final decision — critical issues if sitemap itself failed or major errors found
        // User said: "If any URL returns 4xx / 5xx ... Mark sitemap as Error"
        const hasCriticalErrors = summary.errorCount > 0;

        return {
            status: hasCriticalErrors ? "ERROR" : "SUCCESS",
            summary,
            errors,
        };

    } catch (err) {
        return {
            status: "ERROR",
            summary: { ...summary, accessible: false },
            errors: [{
                url: feedpath,
                type: "System Error",
                description: err.message,
            }],
        };
    }
}
