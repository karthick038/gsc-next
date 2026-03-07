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
