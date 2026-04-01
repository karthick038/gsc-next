import connectDB from "./db";
import Settings from "@/models/Settings";

/**
 * Fetches settings for email configuration
 */
async function getEmailSettings() {
    await connectDB();
    const settings = await Settings.findOne({});
    return settings || {};
}

const APP_NAME = "Google Search Console Analytics";

/**
 * Main entry point for sending health check emails.
 * Branches between EmailJS and Brevo based on user settings.
 */
export async function sendHealthCheckEmail(params) {
    const settings = await getEmailSettings();
    const provider = settings?.emailProvider || "EmailJS";

    if (provider === "Brevo") {
        return sendEmailViaBrevo({ ...params, settings });
    } else {
        return sendEmailViaEmailJS({ ...params, settings });
    }
}

/**
 * Sends a professional health check result email via EmailJS
 */
async function sendEmailViaEmailJS({
    to,
    sitemapUrl,
    status, // SUCCESS or ERROR
    summary,
    errorLogs = [],
    settings // Passed from parent
}) {
    if (!to) return;

    const isSuccess = status === "SUCCESS";
    const checkDate = new Date().toLocaleString();

    try {
        const supportEmail = settings?.senderEmail || "support@colorwhistle.com";
        const websiteLink = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const serviceId = settings?.emailjsServiceId;
        const templateId = isSuccess
            ? (settings?.emailjsTemplateIdSuccess || settings?.emailjsTemplateId)
            : (settings?.emailjsTemplateIdFailed || settings?.emailjsTemplateId);
        const publicKey = settings?.emailjsPublicKey;
        const privateKey = settings?.emailjsPrivateKey;

        if (!serviceId || !templateId || !publicKey) {
            return { success: false, error: "EmailJS configuration incomplete" };
        }

        const errorRowsHtml = errorLogs.slice(0, 10).map(err => `
            <tr>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${err.url}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb; color: #b91c1c;">${err.type}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${err.code || '-'}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${err.description || 'Issue detected during health check.'}</td>
            </tr>
        `).join('');

        const payload = {
            service_id: serviceId,
            template_id: templateId,
            user_id: publicKey,
            accessToken: privateKey,
            template_params: {
                to_email: to,
                from_name: settings?.siteTitle || APP_NAME,
                reply_to: supportEmail,
                website_link: websiteLink,
                company_name: settings?.siteTitle || APP_NAME,
                sitemap_url: sitemapUrl,
                checked_time: checkDate,
                total_urls: summary.totalUrls || 0,
                total_errors: errorLogs.length,
                error_rows: errorRowsHtml || "<tr><td colspan='4' style='padding:8px; text-align:center;'>No critical errors found.</td></tr>",
                response_time: summary.responseTimeMs || 0,
                support_email: supportEmail,
                active_provider: "EmailJS"
            }
        };

        const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `EmailJS Error: ${response.status}`, rawResponse: { status: response.status, body: errorText } };
        }

        return { success: true };
    } catch (err) {
        console.error("sendEmailViaEmailJS - Error:", err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Sends a professional health check result email via Brevo API
 */
async function sendEmailViaBrevo({
    to,
    sitemapUrl,
    status,
    summary,
    errorLogs = [],
    settings
}) {
    if (!to) return;

    const apiKey = settings?.brevoApiKey;
    const senderEmail = settings?.senderEmail || "support@colorwhistle.com";
    const senderName = settings?.siteTitle || APP_NAME;

    if (!apiKey) {
        return { success: false, error: "Brevo API Key is missing" };
    }

    const isSuccess = status === "SUCCESS";
    const checkDate = new Date().toLocaleString();

    // Build HTML content
    const errorRowsHtml = errorLogs.map(err => `
        <tr>
            <td style="padding: 12px 10px; border-bottom: 1px solid #fee2e2; font-size: 13px; color: #4b5563; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${err.url}</td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #fee2e2; font-size: 11px; font-weight: 800; color: #dc2626; text-transform: uppercase; letter-spacing: 0.025em;">${err.type}</td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #fee2e2; font-size: 13px; color: #6b7280; line-height: 1.5;">${err.description || 'Issue detected.'}</td>
        </tr>
    `).join('');

    const headerBg = isSuccess ? '#f0fff4' : '#fff5f5';
    const headerBorder = isSuccess ? '#c6f6d5' : '#fed7d7';
    const headerTitleColor = isSuccess ? '#22543d' : '#822727';
    const accentColor = isSuccess ? '#10b981' : '#ef4444';

    const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; padding: 40px 20px;">
            <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.04), 0 8px 10px -6px rgba(0, 0, 0, 0.04); border: 1px solid #e5e7eb;">
                
                <!-- Header -->
                <div style="padding: 35px; background-color: ${headerBg}; border-bottom: 1px solid ${headerBorder};">
                    <div style="display: flex; align-items: center; margin-bottom: 20px;">
                        <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: ${headerTitleColor}; letter-spacing: -0.01em; text-transform: uppercase; white-space: nowrap;">
                            ${isSuccess ? 'Health Check Passed' : 'Health Check Failed'}
                        </h1>
                        <span style="display: inline-block; padding: 4px 10px; border-radius: 50px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; background-color: ${accentColor}; color: #ffffff; white-space: nowrap; line-height: 2; margin-left: 10px;">
                            ${status}
                        </span>
                    </div>
                    <div style="padding: 12px; background-color: rgba(255,255,255,0.6); border-radius: 8px; border: 1px solid ${headerBorder};">
                        <p style="margin: 0; font-size: 12px; color: ${headerTitleColor}; font-weight: 600; word-break: break-all;">Checked Sitemap : ${sitemapUrl}</p>
                    </div>
                </div>

                <!-- Main Content -->
                <div style="padding: 35px;">
                    
                    <!-- Metadata Grid -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px;">
                        <div style="background-color: #fcfcfc; border-radius: 12px; padding: 15px; border: 1px solid #f3f4f6;">
                            <p style="margin: 0; font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">Total URL Scanned</p>
                            <p style="margin: 4px 0 0; font-size: 24px; font-weight: 800; color: #111827;">${summary.totalUrls || 0}</p>
                        </div>
                        <div style="background-color: #fcfcfc; border-radius: 12px; padding: 15px; border: 1px solid #f3f4f6;">
                            <p style="margin: 0; font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">Total error detected</p>
                            <p style="margin: 4px 0 0; font-size: 24px; font-weight: 800; color: ${!isSuccess ? '#dc2626' : '#111827'};">${errorLogs.length}</p>
                        </div>
                        <div style="grid-column: span 2; background-color: #fcfcfc; border-radius: 12px; padding: 15px; border: 1px solid #f3f4f6;">
                            <p style="margin: 0; font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">Performance Insight</p>
                            <p style="margin: 4px 0 0; font-size: 14px; font-weight: 600; color: #374151;">Sitemap response time: ${summary.responseTimeMs || 0} ms</p>
                        </div>
                        <div style="grid-column: span 2; background-color: #fcfcfc; border-radius: 12px; padding: 15px; border: 1px solid #f3f4f6;">
                            <p style="margin: 0; font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">Checked on timing</p>
                            <p style="margin: 4px 0 0; font-size: 14px; font-weight: 600; color: #374151;">${checkDate}</p>
                        </div>
                    </div>

                    ${errorLogs.length > 0 ? `
                        <div style="margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
                            <h2 style="font-size: 12px; font-weight: 800; color: #111827; text-transform: uppercase; letter-spacing: 0.05em; margin: 0;">Error Breakdown</h2>
                        </div>
                        <div style="border: 1px solid #f3f4f6; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead style="background-color: #f9fafb;">
                                    <tr>
                                        <th style="text-align: left; padding: 12px 10px; font-size: 10px; color: #9ca3af; text-transform: uppercase; border-bottom: 1px solid #f3f4f6;">URL</th>
                                        <th style="text-align: left; padding: 12px 10px; font-size: 10px; color: #9ca3af; text-transform: uppercase; border-bottom: 1px solid #f3f4f6; width: 80px;">Type</th>
                                        <th style="text-align: left; padding: 12px 10px; font-size: 10px; color: #9ca3af; text-transform: uppercase; border-bottom: 1px solid #f3f4f6;">Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${errorRowsHtml}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                    <div style="text-align: center; padding: 40px; background-color: #f0fff4; border: 2px dashed #c6f6d5; border-radius: 16px;">
                        <div style="margin-bottom: 15px; display: inline-block; padding: 12px; background-color: #ffffff; border-radius: 50%; box-shadow: 0 4px 6px rgba(0,0,0,0.02); height: auto; width: auto;">
                            <img src="https://img.icons8.com/flat-round/64/000000/checkmark.png" width="24" height="24" alt="Success" style="vertical-align: middle;" />
                        </div>
                        <p style="margin: 0; color: #166534; font-weight: 800; font-size: 16px;">Sitemap Clean!</p>
                        <p style="margin: 8px 0 0; color: #166534; font-size: 13px; opacity: 0.8;">No issues were detected during this scan.</p>
                    </div>
                    `}
                </div>

                <!-- Footer -->
                <div style="padding: 25px 35px; background-color: #f9fafb; border-top: 1px solid #f3f4f6; text-align: center;">
                    <p style="margin: 0; font-size: 11px; color: #9ca3af; font-weight: 600; letter-spacing: 0.02em;">
                        ${senderName} · Reports generated automatically via GSC Analytics
                    </p>
                </div>
            </div>
        </div>
    `;

    try {
        const payload = {
            sender: { name: senderName, email: senderEmail },
            to: [{ email: to }],
            subject: isSuccess ? `GSC Analytics – Sitemap Health Check Passed` : `GSC Analytics – Sitemap Health Check Failed`,
            htmlContent: htmlContent
        };

        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "api-key": apiKey
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            return { success: false, error: `Brevo API Error: ${errorData.message || response.statusText}` };
        }

        return { success: true };
    } catch (err) {
        console.error("sendEmailViaBrevo - Error:", err.message);
        return { success: false, error: err.message };
    }
}

export async function performSitemapBatchDispatch({ to, submissions }) {
    const settings = await getEmailSettings();
    const provider = settings?.emailProvider || "EmailJS";
    const senderName = settings?.siteTitle || APP_NAME;
    const senderEmail = settings?.senderEmail || "support@colorwhistle.com";

    // Extract and format sitemap URLs for display
    const sitemapUrls = submissions.map(s => s.sitemapUrl);
    const maxUrlsToDisplay = 100; // Increased to 100 as per user request to show all URLs
    const displayedUrls = sitemapUrls.slice(0, maxUrlsToDisplay).join(", ");
    const combinedUrlsLabel = sitemapUrls.length > maxUrlsToDisplay 
        ? `${displayedUrls} and ${sitemapUrls.length - maxUrlsToDisplay} others`
        : displayedUrls;

    const checkDate = new Date().toLocaleString();

    const sitemapSummaryTableRows = submissions.map(s => {
        const errorRows = (s.errorLogs || []).slice(0, 5).map(err => `
            <div style="margin-top: 4px; padding: 6px 10px; background-color: #fffaf0; border-left: 2px solid #ed8936; font-size: 11px; color: #744210;">
                <strong style="color: #c05621;">${err.type}:</strong> ${err.url} 
                <div style="font-size: 10px; opacity: 0.8; margin-top: 2px;">${err.description || ''}</div>
            </div>
        `).join('');

        return `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #111827; font-weight: 700; word-break: break-all; vertical-align: top;">
                    ${s.sitemapUrl}
                    ${errorRows ? `<div style="margin-top: 8px;">${errorRows}</div>` : ''}
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; vertical-align: top;">
                    <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.025em; background-color: ${s.healthStatus === 'ERROR' ? '#fee2e2' : '#f0fff4'}; color: ${s.healthStatus === 'ERROR' ? '#991b1b' : '#166534'};">
                        ${s.healthStatus || 'QUEUED'}
                    </span>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; font-weight: 800; color: ${s.errorCount > 0 ? '#dc2626' : '#10b981'}; vertical-align: top;">${s.errorCount || 0}</td>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; font-size: 12px; color: #6b7280; vertical-align: top;">${new Date(s.submittedAt).toLocaleDateString()}</td>
            </tr>
        `;
    }).join('');

    const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; background-color: #f9fafb;">
            <div style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #e5e7eb;">
                <div style="padding: 30px; border-bottom: 1px solid #e5e7eb; background-color: #ffffff;">
                    <h2 style="margin: 0; color: #111827; font-size: 20px; font-weight: 800; letter-spacing: -0.025em;">Consolidated Sitemap Report</h2>
                    <p style="margin: 8px 0 0; font-size: 14px; color: #6b7280;">Batched report for <strong>${submissions.length}</strong> sitemap submission(s).</p>
                </div>
                <div style="padding: 20px; overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; min-width: 600px;">
                        <thead>
                            <tr style="background-color: #f9fafb;">
                                <th style="padding: 12px; text-align: left; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb;">Sitemap & Details</th>
                                <th style="padding: 12px; text-align: left; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; width: 100px;">Status</th>
                                <th style="padding: 12px; text-align: left; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; width: 80px;">Errors</th>
                                <th style="padding: 12px; text-align: left; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; width: 100px;">Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sitemapSummaryTableRows}
                        </tbody>
                    </table>
                </div>
                <div style="padding: 20px 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af; font-weight: 500;">
                        Total Items in Batch: <strong>${submissions.length}</strong> · Generated on ${checkDate}
                    </p>
                </div>
            </div>
        </div>
    `;

    if (provider === "Brevo") {
        const apiKey = settings?.brevoApiKey;
        if (!apiKey) return { success: false, error: "Brevo API Key missing" };

        const payload = {
            sender: { name: senderName, email: senderEmail },
            to: [{ email: to }],
            subject: `Sitemap Batch Report (${submissions.length} items)`,
            htmlContent: htmlContent
        };

        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "Content-Type": "application/json", "api-key": apiKey },
            body: JSON.stringify(payload)
        });

        return response.ok ? { success: true } : { success: false, error: "Brevo API failed" };
    } else {
        // EmailJS Implementation for Batching
        const serviceId = settings?.emailjsServiceId;
        const templateId = settings?.emailjsTemplateIdSuccess || settings?.emailjsTemplateId;
        const publicKey = settings?.emailjsPublicKey;
        const privateKey = settings?.emailjsPrivateKey;

        if (!serviceId || !templateId || !publicKey) {
            return { success: false, error: "EmailJS configuration incomplete" };
        }

        const payload = {
            service_id: serviceId,
            template_id: templateId,
            user_id: publicKey,
            accessToken: privateKey,
            template_params: {
                to_email: to,
                from_name: senderName,
                reply_to: senderEmail,
                company_name: senderName,
                sitemap_url: combinedUrlsLabel,
                checked_time: checkDate,
                total_urls: submissions.length,
                total_errors: submissions.filter(s => s.healthStatus === "ERROR").length,
                error_rows: `
                    <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                        <table style="width: 100%; border-collapse: collapse; font-family: sans-serif;">
                            <tr style="background-color: #f9fafb;">
                                <th style="padding: 10px; text-align: left; font-size: 10px; border-bottom: 1px solid #e5e7eb;">Sitemap & Details</th>
                                <th style="padding: 10px; text-align: left; font-size: 10px; border-bottom: 1px solid #e5e7eb; width: 80px;">Status</th>
                                <th style="padding: 10px; text-align: left; font-size: 10px; border-bottom: 1px solid #e5e7eb; width: 60px;">Errors</th>
                                <th style="padding: 10px; text-align: left; font-size: 10px; border-bottom: 1px solid #e5e7eb; width: 80px;">Date</th>
                            </tr>
                            ${sitemapSummaryTableRows}
                        </table>
                    </div>
                `,
                support_email: senderEmail,
                active_provider: "EmailJS (Batch)"
            }
        };

        const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `EmailJS API Error: ${response.status}`, rawResponse: errorText };
        }

        return { success: true };
    }
}
