import Settings from "@/models/Settings";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { checkAndDispatchSitemapBatch, calculateNextDynamicRun } from "@/lib/sitemap-service";

export async function GET() {
    try {
        await connectDB();
        let settings = await Settings.findOne({});
        if (!settings) {
            settings = await Settings.create({
                siteTitle: "GSC Dashboard",
                logoUrl: "/images/branding/colorwhistle-logo.png",
                faviconUrl: "/favicon.ico"
            });
        }

        // --- PASSIVE SAFETY NET ---
        // If overdue and not currently processing, nudge the background dispatcher.
        // This is fire-and-forget — the background worker owns the mutex.
        if (settings.sitemapNextRunDate && new Date(settings.sitemapNextRunDate) < new Date() && !settings.sitemapIsProcessing) {
            checkAndDispatchSitemapBatch("SETTINGS-API-NUDGE").catch(err =>
                console.error("[SETTINGS-API] Background dispatch nudge error:", err.message)
            );
        }

        const settingsObj = settings.toObject();
        // Return the exact next run date as stored in the database
        settingsObj.nextRunDate = settings.sitemapNextRunDate;
        settingsObj.isProcessing = settings.sitemapIsProcessing;

        return NextResponse.json(settingsObj);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request) {
    const session = await auth();
    const role = session?.user?.role?.toLowerCase();

    if (role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const {
            siteTitle, logoUrl, faviconUrl, logoWidth, logoHeight,
            emailProvider, brevoApiKey,
            senderEmail,
            emailjsServiceId, emailjsTemplateId, emailjsTemplateIdSuccess, emailjsTemplateIdFailed,
            emailjsPublicKey, emailjsPrivateKey,
            sitemapBatchingEnabled, sitemapLastRunDate,
            notificationEmail,
            sitemapInterval, sitemapReferenceTime,
            reportingEnabled, reportingInterval, reportingReferenceTime
        } = body;

        await connectDB();
        
        // 1. Calculate new next runs if scheduling changed
        let nextRunUpdate = {};
        const currentSettings = await Settings.findOne({});
        
        // Sitemap Engine Rescheduling
        if (sitemapInterval !== undefined || sitemapReferenceTime !== undefined) {
            const tempSitemapSettings = {
                ...currentSettings?.toObject(),
                sitemapInterval: sitemapInterval !== undefined ? sitemapInterval : currentSettings?.sitemapInterval,
                sitemapReferenceTime: sitemapReferenceTime !== undefined ? sitemapReferenceTime : currentSettings?.sitemapReferenceTime
            };
            nextRunUpdate.sitemapNextRunDate = calculateNextDynamicRun(tempSitemapSettings, "sitemap");
        }

        // Reporting Engine Rescheduling
        if (reportingInterval !== undefined || reportingReferenceTime !== undefined) {
             const tempReportingSettings = {
                ...currentSettings?.toObject(),
                reportingInterval: reportingInterval !== undefined ? reportingInterval : currentSettings?.reportingInterval,
                reportingReferenceTime: reportingReferenceTime !== undefined ? reportingReferenceTime : currentSettings?.reportingReferenceTime
            };
            nextRunUpdate.reportingNextRunDate = calculateNextDynamicRun(tempReportingSettings, "reporting");
        }

        // 2. Perform Update
        const updatedSettings = await Settings.findOneAndUpdate(
            {},
            {
                $set: {
                    siteTitle, logoUrl, faviconUrl, logoWidth, logoHeight,
                    emailProvider, brevoApiKey,
                    senderEmail,
                    emailjsServiceId, emailjsTemplateId, emailjsTemplateIdSuccess, emailjsTemplateIdFailed,
                    emailjsPublicKey, emailjsPrivateKey,
                    sitemapBatchingEnabled, sitemapLastRunDate,
                    notificationEmail,
                    sitemapInterval, sitemapReferenceTime,
                    reportingEnabled, reportingInterval, reportingReferenceTime,
                    ...nextRunUpdate
                }
            },
            { upsert: true, new: true }
        );

        return NextResponse.json(updatedSettings);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
