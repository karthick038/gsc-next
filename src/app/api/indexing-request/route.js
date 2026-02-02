import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/db";
import File from "@/models/File";
import Submission from "@/models/Submission";
import WebsiteQuota from "@/models/WebsiteQuota";
import User from "@/models/User";
import ServiceAccount from "@/models/ServiceAccount";
import { google } from "googleapis";
import { decrypt } from "@/lib/encryption";
import mongoose from "mongoose";
import { normalizeWebsite, getTodayDate } from "@/lib/utils";

export const dynamic = 'force-dynamic';

export async function POST(request) {
    let session;
    let currentStep = "INITIALIZING";
    try {
        // 1. Validate Session
        currentStep = "VALIDATING_SESSION";
        session = await auth();
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;

        // 2. Parse Request Body
        currentStep = "PARSING_BODY";
        const body = await request.json();
        let { urls, type, selectedWebsite } = body;

        if (body.url && !urls) {
            urls = [body.url];
        }

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return NextResponse.json({ error: "No URLs provided" }, { status: 400 });
        }

        const notificationType = type || "URL_UPDATED";
        if (!["URL_UPDATED", "URL_DELETED"].includes(notificationType)) {
            return NextResponse.json({ error: "Invalid notification type" }, { status: 400 });
        }

        if (!selectedWebsite) {
            return NextResponse.json({ error: "No website property selected." }, { status: 400 });
        }

        const normalizedSelectedSite = normalizeWebsite(selectedWebsite);

        currentStep = "CONNECTING_DB";
        await connectDB();

        // 3. Quota Initialization (Pre-check)
        currentStep = "CHECKING_QUOTA";
        const today = getTodayDate();

        // Atomic search-and-create to prevent race conditions (E11000)
        let quota;
        try {
            quota = await WebsiteQuota.findOneAndUpdate(
                { website: normalizedSelectedSite, date: today, userId },
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
                quota = await WebsiteQuota.findOne({ website: normalizedSelectedSite, date: today, userId });
            } else {
                throw e;
            }
        }

        const remaining = quota ? (quota.limit - quota.used) : 200;
        if (urls.length > remaining) {
            return NextResponse.json({
                error: `Quota exceeded for this website. You have ${remaining} URLs remaining for today, but tried to submit ${urls.length}.`
            }, { status: 429 });
        }

        // 4. Get User and Valid Service Accounts
        currentStep = "FETCHING_CREDENTIALS";
        const [user, accounts] = await Promise.all([
            User.findById(userId),
            ServiceAccount.find({ userId, isValid: true })
        ]);

        if (!user || user.indexingStatus === "DISCONNECTED") {
            return NextResponse.json({ error: "No connected websites found. Please test connection first." }, { status: 403 });
        }

        if (accounts.length === 0) {
            return NextResponse.json({ error: "No valid service accounts found." }, { status: 404 });
        }

        // 5. Gather all accessible sites across all service accounts
        currentStep = "GATHERING_ACCESSIBLE_SITES";
        const allAccessibleSites = new Map(); // siteUrl -> credentials

        for (const acc of accounts) {
            try {
                const decryptedText = decrypt(acc.encryptedJson);
                if (!decryptedText) continue;
                const credentials = JSON.parse(decryptedText);

                const authClient = new google.auth.GoogleAuth({
                    credentials: {
                        client_email: credentials.client_email,
                        private_key: credentials.private_key,
                    },
                    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
                });

                const searchConsole = google.searchconsole({ version: "v1", auth: authClient });
                const sitesRes = await searchConsole.sites.list();
                const sitesList = (sitesRes.data && sitesRes.data.siteEntry) || [];

                sitesList.forEach(s => {
                    const normalized = normalizeWebsite(s.siteUrl);
                    if (!allAccessibleSites.has(normalized)) {
                        allAccessibleSites.set(normalized, credentials);
                    }
                });
            } catch (err) {
                console.error(`Failed to load sites for ${acc.filename}:`, err.message);
            }
        }

        // 6. Identify Credentials and Valid URLs
        currentStep = "NORMALIZING_URLS";
        const finalResults = [];
        const validUrlsToProcess = [];

        const credentials = allAccessibleSites.get(normalizedSelectedSite);

        if (!credentials) {
            return NextResponse.json({ error: `No valid service account found with permission for ${selectedWebsite}` }, { status: 403 });
        }

        // Pre-normalize selected domain for matching
        let selectedDomain = "";
        try {
            selectedDomain = new URL(selectedWebsite).hostname.toLowerCase().replace(/^www\./, "");
        } catch (e) {
            selectedDomain = selectedWebsite.toLowerCase().replace(/^www\./, "").split('/')[0];
        }

        for (const url of urls) {
            try {
                const urlObj = new URL(url);
                const targetHost = urlObj.hostname.toLowerCase().replace(/^www\./, "");

                // Domain match check (Robust)
                if (selectedDomain && targetHost !== selectedDomain) {
                    finalResults.push({
                        url,
                        status: "ERROR",
                        error: `URL domain mismatch. Expected ${selectedDomain}, got ${targetHost}`,
                        httpCode: 403
                    });
                    continue;
                }

                validUrlsToProcess.push({ url });
            } catch (e) {
                finalResults.push({ url, status: "ERROR", error: "Invalid URL format or protocol", httpCode: 400 });
            }
        }

        if (validUrlsToProcess.length === 0 && finalResults.length === 0) {
            return NextResponse.json({ error: "No valid URLs found in request." }, { status: 400 });
        }

        if (validUrlsToProcess.length === 0) {
            return NextResponse.json({ results: finalResults }, { status: 200 });
        }

        // 7. Process Valid URLs via Google Indexing Batch API (Multipart/Mixed)
        currentStep = "BATCH_PROCESSING";
        const processingResults = [];
        const actionLabel = notificationType === "URL_UPDATED" ? "Publish" : "Remove";

        try {
            const jwtClient = new google.auth.JWT({
                email: credentials.client_email,
                key: credentials.private_key,
                scopes: ["https://www.googleapis.com/auth/indexing"],
            });

            const tokens = await jwtClient.authorize();
            const token = tokens.access_token;
            const boundary = "indexing_batch_boundary_" + Date.now();
            const CRLF = "\r\n";
            let batchBody = "";

            validUrlsToProcess.forEach((item, index) => {
                batchBody += `--${boundary}${CRLF}`;
                batchBody += `Content-Type: application/http${CRLF}`;
                batchBody += `Content-Transfer-Encoding: binary${CRLF}`;
                batchBody += `Content-ID: <item${index}>${CRLF}${CRLF}`;
                batchBody += `POST /v3/urlNotifications:publish HTTP/1.1${CRLF}`;
                batchBody += `Content-Type: application/json${CRLF}${CRLF}`;
                batchBody += JSON.stringify({
                    url: item.url,
                    type: notificationType,
                }) + CRLF;
            });
            batchBody += `--${boundary}--${CRLF}`;

            const batchResponse = await fetch("https://indexing.googleapis.com/batch", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": `multipart/mixed; boundary=${boundary}`,
                },
                body: batchBody,
            });

            if (!batchResponse.ok) {
                const errorText = await batchResponse.text();
                throw new Error(`Google Batch API rejected the batch: ${batchResponse.status} ${errorText}`);
            }

            const responseText = await batchResponse.text();

            const contentType = batchResponse.headers.get("content-type") || "";
            const boundaryMatch = contentType.match(/boundary=([^;]+)/);
            const respBoundary = boundaryMatch ? boundaryMatch[1].replace(/["']/g, "") : boundary;

            const parts = responseText.split(`--${respBoundary}`).filter(p => {
                const t = p.trim();
                return t && t !== "--" && t !== "";
            });

            for (let i = 0; i < validUrlsToProcess.length; i++) {
                try {
                    const url = validUrlsToProcess[i].url;
                    const part = parts[i] || "";

                    let statusCode = 500;
                    let responseData = { error: "No response part found for this URL" };

                    try {
                        const statusLine = part.match(/HTTP\/1\.[01]\s+(\d+)/);
                        if (statusLine) {
                            statusCode = parseInt(statusLine[1]);
                        }

                        const bodyStart = part.indexOf("{");
                        const bodyEnd = part.lastIndexOf("}");
                        if (bodyStart !== -1 && bodyEnd !== -1) {
                            responseData = JSON.parse(part.substring(bodyStart, bodyEnd + 1));
                        }
                    } catch (parseError) {
                        console.error("Failed to parse batch part content:", parseError);
                    }

                    const isSuccess = statusCode >= 200 && statusCode < 300;
                    const responseMsg = isSuccess
                        ? "Successfully submitted to Google Indexing API"
                        : (responseData.error?.message || responseData.error || "Batch processing error");

                    // Record in History
                    try {
                        await Submission.create({
                            userId: userId,
                            website: selectedDomain || new URL(url).hostname.replace(/^www\./, ""),
                            url,
                            action: actionLabel,
                            statusCode: statusCode,
                            status: isSuccess ? "success" : "failed",
                            responseMessage: responseMsg,
                            rawResponse: responseData,
                            submittedAt: new Date(),
                        });
                    } catch (dbError) {
                        console.error("DB Error recording submission:", dbError);
                    }

                    processingResults.push({
                        url,
                        status: isSuccess ? "SUCCESS" : "ERROR",
                        data: isSuccess ? responseData : undefined,
                        error: isSuccess ? undefined : responseMsg,
                        httpCode: statusCode
                    });
                } catch (itemErr) {
                    console.error("Error processing individual batch item:", itemErr);
                    processingResults.push({
                        url: validUrlsToProcess[i]?.url || "Unknown",
                        status: "ERROR",
                        error: "Internal loop error: " + itemErr.message,
                        httpCode: 500
                    });
                }
            }

        } catch (batchErr) {
            console.error("CRITICAL: Batch overall failure catch triggered:", batchErr.message);
            validUrlsToProcess.forEach(item => {
                processingResults.push({
                    url: item.url,
                    status: "ERROR",
                    error: batchErr.message || "The batch request itself failed",
                    httpCode: 500
                });
            });
        }

        const combinedResults = [...finalResults, ...processingResults];

        // 8. Update Website Quota
        currentStep = "UPDATING_QUOTA_STATS";
        try {
            const successCount = processingResults.filter(r => r.status === "SUCCESS").length;
            if (successCount > 0 && quota) {
                await WebsiteQuota.findByIdAndUpdate(quota._id, { $inc: { used: successCount } });
            }
        } catch (quotaError) {
            console.error("Failed to update website quota:", quotaError);
        }

        return NextResponse.json({ results: combinedResults }, { status: 200 });

    } catch (error) {
        console.error("CRITICAL INDEXING API ERROR:", {
            step: currentStep,
            message: error.message,
            stack: error.stack,
            userId: session?.user?.id || "unknown"
        });
        return NextResponse.json({
            error: "Internal Server Error",
            details: `Failed at ${currentStep}: ${error.message}`
        }, { status: 500 });
    }
}
