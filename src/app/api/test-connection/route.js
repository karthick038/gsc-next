import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/db";
import ServiceAccount from "@/models/ServiceAccount";
import User from "@/models/User";
import { google } from "googleapis";
import { decrypt } from "@/lib/encryption";

export async function POST(request) {
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ status: "FAIL", error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        const { siteUrls: bodySiteUrls, accountIds } = await request.json().catch(() => ({}));

        await connectDB();

        // Fetch User and relevant Service Accounts
        const user = await User.findById(userId);
        if (!user) {
            return NextResponse.json({ status: "FAIL", error: "User not found" }, { status: 404 });
        }

        // If accountIds is provided, only test those. Otherwise, test all.
        const accountQuery = { userId };
        if (accountIds && Array.isArray(accountIds) && accountIds.length > 0) {
            accountQuery._id = { $in: accountIds };
        }

        const accounts = await ServiceAccount.find(accountQuery);

        const siteUrls = bodySiteUrls || user.siteUrls || [];
        if (siteUrls.length === 0) {
            return NextResponse.json({
                status: "FAIL",
                error: "At least one Search Console property URL is required."
            }, { status: 400 });
        }

        if (accounts.length === 0) {
            return NextResponse.json({
                status: "FAIL",
                error: "No matching service account credentials found for this test."
            }, { status: 404 });
        }

        const accountResults = [];
        const permissionMap = new Map(); // siteUrl -> { permissionLevel, accountEmail }

        for (const acc of accounts) {
            try {
                const decryptedText = decrypt(acc.encryptedJson);
                if (!decryptedText) throw new Error("Failed to decrypt credential");

                const credentials = JSON.parse(decryptedText);

                const authClient = new google.auth.GoogleAuth({
                    credentials: {
                        client_email: credentials.client_email,
                        private_key: credentials.private_key,
                    },
                    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
                });

                const searchConsole = google.searchconsole({
                    version: "v1",
                    auth: authClient,
                });

                const sitesRes = await searchConsole.sites.list();
                const sitesList = sitesRes.data.siteEntry || [];

                sitesList.forEach(s => {
                    const normalized = s.siteUrl.toLowerCase().replace(/\/$/, "");

                    // Priority to 'siteOwner' if multiple accounts have access
                    const existing = permissionMap.get(normalized);
                    if (!existing || s.permissionLevel === "siteOwner") {
                        permissionMap.set(normalized, {
                            permissionLevel: s.permissionLevel,
                            accountEmail: acc.clientEmail
                        });
                    }
                });

                acc.isValid = true;
                await acc.save();

                accountResults.push({
                    id: acc._id,
                    filename: acc.filename,
                    status: "SUCCESS",
                    sitesCount: sitesList.length
                });

            } catch (err) {
                console.error(`Test failed for ${acc.filename}:`, err.message);
                acc.isValid = false;
                await acc.save();

                accountResults.push({
                    id: acc._id,
                    filename: acc.filename,
                    status: "ERROR",
                    error: err.message
                });
            }
        }

        // URL-Level Validation (Strict)
        // We only mark SUCCESS if the URL matches an accessible site from THE CURRENTLY TESTED ACCOUNTS
        const urlResults = siteUrls.map(url => {
            const normalizedUserUrl = url.toLowerCase().replace(/\/$/, "").replace(/^https?:\/\//, "").replace(/^www\./, "");

            let matchedPermission = "none";
            let matchedEmail = null;
            let hasAccess = false;

            for (const [gSite, data] of permissionMap.entries()) {
                const normalizedGSite = gSite.replace(/^sc-domain:/, "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
                if (normalizedGSite === normalizedUserUrl) {
                    hasAccess = true;
                    matchedPermission = data.permissionLevel;
                    matchedEmail = data.accountEmail;
                    break;
                }
            }

            return {
                url,
                status: hasAccess ? "SUCCESS" : "ERROR",
                permissionLevel: matchedPermission,
                accountEmail: matchedEmail,
                error: hasAccess ? null : "Access denied for these credentials."
            };
        });

        const successCount = urlResults.filter(r => r.status === "SUCCESS").length;
        const failCount = urlResults.length - successCount;
        let finalStatus = "DISCONNECTED";

        if (successCount === siteUrls.length && successCount > 0) {
            finalStatus = "CONNECTED";
        } else if (successCount > 0) {
            finalStatus = "PARTIAL";
        }

        // Update User Connection Meta
        user.indexingStatus = finalStatus;
        user.lastConnectionTestAt = new Date();

        // Update verifiedSites with CURRENT test results: Success Only
        const verifiedMap = new Map((user.verifiedSites || []).map(v => [v.url, v]));

        urlResults.forEach(r => {
            if (r.status === "SUCCESS") {
                // Add or Update successful connection
                verifiedMap.set(r.url, {
                    url: r.url,
                    status: r.status,
                    permissionLevel: r.permissionLevel || "none",
                    accountEmail: r.accountEmail,
                    error: null
                });
            } else {
                // FAILURE: Remove from verifiedSites to ensure "No success -> No card"
                verifiedMap.delete(r.url);
            }
        });

        user.verifiedSites = Array.from(verifiedMap.values());

        // Final sanity check on counts based on total verifiedSites
        const totalConnected = user.verifiedSites.filter(v => v.status === "SUCCESS").length;
        user.connectedSitesCount = totalConnected;
        user.sitesWithPermission = totalConnected;
        user.sitesWithoutPermission = user.verifiedSites.length - totalConnected;

        await user.save();

        return NextResponse.json({
            status: (finalStatus === "CONNECTED" || finalStatus === "PARTIAL") ? "PASS" : "FAIL",
            indexingStatus: finalStatus,
            message: finalStatus === "CONNECTED" ? "All properties verified" : (finalStatus === "PARTIAL" ? "Some properties missing access" : "Verification failed"),
            connectedSitesCount: totalConnected,
            urlResults,
            accountResults,
            sites: urlResults.map(r => ({
                siteUrl: r.url,
                status: r.status,
                permissionLevel: r.permissionLevel
            }))
        });

    } catch (error) {
        console.error("Test Connection Error:", error);
        return NextResponse.json({
            status: "FAIL",
            error: error.message || "Failed to execute connection test."
        }, { status: 500 });
    }
}
