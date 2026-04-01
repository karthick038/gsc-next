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
const GSC_BASE_URL = "https://search.google.com/search-console/sitemaps";

/**
 * Generates a GSC link for a sitemap URL by extracting the origin.
 * Standard GSC properties use the origin as the resource_id.
 */
function getGSCLink(sitemapUrl) {
    try {
        const url = new URL(sitemapUrl);
        const resourceId = encodeURIComponent(url.origin + "/");
        return `${GSC_BASE_URL}?resource_id=${resourceId}`;
    } catch (err) {
        return GSC_BASE_URL;
    }
}

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

        // --- PREMIUM REDESIGN FOR SINGLE REPORT EMAIL ---
        const headerBg = isSuccess ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)';
        const cardBg = "#ffffff";
        const accentColor = isSuccess ? '#10b981' : '#f43f5e';

        // ALIGNED 4-COLUMN LOGIC FOR EMAILJS TEMPLATES
        const errorRowsHtml = errorLogs.map(err => `
            <tr>
                <td style="padding: 14px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; font-family: ui-monospace, SFMono-Regular, menlo, monaco, consolas, monospace; word-break: break-all;">${err.url}</td>
                <td style="padding: 14px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; width: 100px;">
                    <span style="display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; background-color: #fff1f2; color: #e11d48; border: 1px solid #ffe4e6; white-space: nowrap;">
                         ${err.type}
                    </span>
                </td>
                <td style="padding: 14px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #64748b; font-weight: 700; text-align: center;">${err.code || '-'}</td>
                <td style="padding: 14px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; color: #64748b; line-height: 1.5;">${err.description || 'Issue detected během health checku.'}</td>
            </tr>
        `).join('');

        const htmlContent = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px;">
                <div style="max-width: 650px; margin: 0 auto; background-color: ${cardBg}; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                    <!-- Header with Gradient -->
                    <div style="padding: 40px 35px; background: ${headerBg}; text-align: left;">
                        <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.02em; text-transform: uppercase;">
                            ${isSuccess ? 'Health Check Passed' : 'Health Check Failed'}
                        </h1>
                        <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.9); font-weight: 500; opacity: 0.9;">
                             ${status} · Report generated on ${checkDate}
                        </p>
                    </div>

                    <!-- Sitemap Badge & Action -->
                    <div style="padding: 25px 35px; background-color: #f1f5f9; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
                        <div style="flex: 1; min-width: 250px;">
                            <p style="margin: 0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Checked Sitemap</p>
                            <div style="font-size: 14px; color: #1e293b; font-weight: 600; word-break: break-all; font-family: ui-monospace, SFMono-Regular, monospace;">
                                ${sitemapUrl}
                            </div>
                        </div>
                        ${isSuccess ? `
                        <a href="${getGSCLink(sitemapUrl)}" style="display: inline-block; padding: 12px 22px; background-color: ${accentColor}; color: #ffffff; text-decoration: none; border-radius: 10px; font-size: 13px; font-weight: 900; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); white-space: nowrap; transition: transform 0.2s ease;">
                            View Full Report in GSC
                        </a>
                        ` : ''}
                    </div>

                    <div style="padding: 35px;">
                        <!-- Summary Cards (Glassmorphism look) -->
                        <div style="display: flex; gap: 15px; margin-bottom: 35px;">
                            <div style="flex: 1; background-color: #ffffff; border-radius: 12px; padding: 18px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
                                <p style="margin: 0; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;">URLs Scanned</p>
                                <p style="margin: 6px 0 0; font-size: 28px; font-weight: 900; color: #1e293b;">${summary.totalUrls || 0}</p>
                            </div>
                            <div style="flex: 1; background-color: #ffffff; border-radius: 12px; padding: 18px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
                                <p style="margin: 0; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;">Errors Detected</p>
                                <p style="margin: 6px 0 0; font-size: 28px; font-weight: 900; color: ${!isSuccess ? '#e11d48' : '#1e293b'};">${errorLogs.length}</p>
                            </div>
                        </div>

                        ${errorLogs.length > 0 ? `
                            <h2 style="font-size: 13px; font-weight: 900; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 15px;">Detailed Breakdown</h2>
                            <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
                                <table style="width: 100%; border-collapse: collapse;">
                                    <thead style="background-color: #f8fafc;">
                                        <tr>
                                            <th style="padding: 12px; text-align: left; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">URL</th>
                                            <th style="padding: 12px; text-align: left; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Type</th>
                                            <th style="padding: 12px; text-align: left; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; width: 60px;">Code</th>
                                            <th style="padding: 12px; text-align: left; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${errorRowsHtml}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <div style="text-align: center; padding: 45px 20px; background-color: #f0fdf4; border: 2px dashed #bbf7d0; border-radius: 16px;">
                                <div style="font-size: 32px; margin-bottom: 15px;">✅</div>
                                <p style="margin: 0; color: #166534; font-weight: 900; font-size: 18px; letter-spacing: -0.01em;">Sitemap is perfectly clean!</p>
                                <p style="margin: 8px 0 0; color: #15803d; font-size: 14px; font-weight: 500; opacity: 0.8;">No accessibility or structural issues were detected.</p>
                            </div>
                        `}

                        <div style="margin-top: 35px; padding: 20px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #f1f5f9;">
                             <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.6;">
                                <strong>Performance:</strong> Sitemap response time was ${summary.responseTimeMs || 0}ms. <br/>
                                <span style="font-size: 11px; opacity: 0.7;">This report is automated. For any questions, contact <a href="mailto:${supportEmail}" style="color: ${accentColor}; text-decoration: none; font-weight: 700;">${supportEmail}</a></span>
                             </p>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div style="padding: 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
                        <p style="margin: 0; font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">
                            ${settings?.siteTitle || APP_NAME} · Global Sitemap Intelligence
                        </p>
                    </div>
                </div>
            </div>
        `;

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
                // Pass the new premium HTML content
                html_content: htmlContent,
                // ALIGNED 4-COLUMN ROWS FOR USER'S EMAILJS TEMPLATE
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

    // PREMIUM UI REDESIGN
    const headerBg = isSuccess ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)';
    const accentColor = isSuccess ? '#10b981' : '#f43f5e';

    const errorRowsHtml = errorLogs.map(err => `
        <tr>
            <td style="padding: 14px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; font-family: ui-monospace, SFMono-Regular, menlo, monaco, consolas, monospace; word-break: break-all;">${err.url}</td>
            <td style="padding: 14px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; width: 100px;">
                <span style="display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; background-color: #fff1f2; color: #e11d48; border: 1px solid #ffe4e6; white-space: nowrap;">
                     ${err.type}
                </span>
            </td>
            <td style="padding: 14px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #64748b; font-weight: 700; text-align: center;">${err.code || '-'}</td>
            <td style="padding: 14px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; color: #64748b; line-height: 1.5;">${err.description || 'Issue detected.'}</td>
        </tr>
    `).join('');

    const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px;">
            <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                <!-- Header -->
                <div style="padding: 40px 35px; background: ${headerBg}; text-align: left;">
                    <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.02em; text-transform: uppercase;">
                        ${isSuccess ? 'Health Check Passed' : 'Health Check Failed'}
                    </h1>
                     <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.9); font-weight: 500; opacity: 0.9;">
                        ${status} · Report generated on ${checkDate}
                    </p>
                </div>

                <!-- Sitemap Badge -->
                <div style="padding: 20px 35px; background-color: #f1f5f9; border-bottom: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Checked Sitemap</p>
                    <div style="font-size: 14px; color: #1e293b; font-weight: 600; word-break: break-all; font-family: ui-monospace, SFMono-Regular, monospace;">
                        ${sitemapUrl}
                    </div>
                </div>

                <div style="padding: 35px;">
                    <div style="display: flex; gap: 15px; margin-bottom: 35px;">
                        <div style="flex: 1; background-color: #ffffff; border-radius: 12px; padding: 18px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
                            <p style="margin: 0; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;">URLs Scanned</p>
                            <p style="margin: 6px 0 0; font-size: 28px; font-weight: 900; color: #1e293b;">${summary.totalUrls || 0}</p>
                        </div>
                        <div style="flex: 1; background-color: #ffffff; border-radius: 12px; padding: 18px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
                            <p style="margin: 0; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;">Errors Detected</p>
                            <p style="margin: 6px 0 0; font-size: 28px; font-weight: 900; color: ${!isSuccess ? '#e11d48' : '#1e293b'};">${errorLogs.length}</p>
                        </div>
                    </div>

                    ${errorLogs.length > 0 ? `
                        <h2 style="font-size: 13px; font-weight: 900; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 15px;">Detailed Breakdown</h2>
                        <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead style="background-color: #f8fafc;">
                                    <tr>
                                        <th style="padding: 12px; text-align: left; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">URL</th>
                                        <th style="padding: 12px; text-align: left; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Type</th>
                                        <th style="padding: 12px; text-align: left; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; width: 60px;">Code</th>
                                        <th style="padding: 12px; text-align: left; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${errorRowsHtml}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 45px 20px; background-color: #f0fdf4; border: 2px dashed #bbf7d0; border-radius: 16px;">
                            <div style="font-size: 32px; margin-bottom: 15px;">✅</div>
                            <p style="margin: 0; color: #166534; font-weight: 900; font-size: 18px; letter-spacing: -0.01em;">Sitemap is perfectly clean!</p>
                            <p style="margin: 8px 0 0; color: #15803d; font-size: 14px; font-weight: 500; opacity: 0.8;">No issues were detected during this scan.</p>
                        </div>
                    `}
                    
                    <div style="margin-top: 35px; padding: 20px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #f1f5f9;">
                         <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.6;">
                            <strong>Performance:</strong> Sitemap response time was ${summary.responseTimeMs || 0}ms. <br/>
                            <span style="font-size: 11px; opacity: 0.7;">This report is automated. For any questions, contact <a href="mailto:${senderEmail}" style="color: ${accentColor}; text-decoration: none; font-weight: 700;">${senderEmail}</a></span>
                         </p>
                    </div>
                </div>

                <!-- Footer -->
                <div style="padding: 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
                    <p style="margin: 0; font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">
                        ${senderName} · Reports generated automatically via GSC Analytics
                    </p>
                </div>
            </div>
        </div>
    `;

    try {
        const payload = {
            sender: { name: senderName, email: senderEmail },
            to: to.split(",").map(email => ({ email: email.trim() })).filter(e => e.email),
            subject: isSuccess ? `GSC Analytics – Sitemap Health Check Passed` : `GSC Analytics – Sitemap Health Check Failed`,
            htmlContent: htmlContent
        };

        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "Content-Type": "application/json", "api-key": apiKey },
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

    const sitemapEntries = submissions.map(s => {
        const isError = s.healthStatus === "ERROR" || (s.errorCount > 0);
        return `${isError ? "❌ FAIL" : "✅ PASS"}: ${s.sitemapUrl}`;
    });

    const maxLinesToDisplay = 100;
    const displayedLines = sitemapEntries.slice(0, maxLinesToDisplay).join("\n");
    const combinedUrlsLabel = sitemapEntries.length > maxLinesToDisplay 
        ? `${displayedLines}\n... and ${sitemapEntries.length - maxLinesToDisplay} more`
        : displayedLines;

    const checkDate = new Date().toLocaleString();

    // Strategy for EmailJS compatibility:
    // We need to provide a FLAT list of individual errors for users using the 4-column table.
    let allErrorsFlattened = [];
    submissions.forEach(s => {
        (s.errorLogs || []).forEach(err => {
            allErrorsFlattened.push({
                url: err.url,
                type: err.type,
                code: err.code || '-',
                description: err.description || `Sitemap: ${s.sitemapUrl}`,
                parentSitemap: s.sitemapUrl
            });
        });
    });

    // 4-COLUMN LOGIC FOR USER'S EMAILJS TEMPLATE (URL, Type, Code, Description)
    // Now including the parent sitemap in the description for extreme clarity
    const emailJS_error_rows = allErrorsFlattened.map(err => `
        <tr>
            <td style="padding: 14px 12px; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-family: ui-monospace, monospace; word-break: break-all; color: #1e293b;">${err.url}</td>
            <td style="padding: 14px 12px; border-bottom: 1px solid #f1f5f9; font-weight: 800; color: #e11d48; font-size: 10px; text-transform: uppercase;">${err.type}</td>
            <td style="padding: 14px 12px; border-bottom: 1px solid #f1f5f9; text-align: center; font-weight: 800; color: #64748b; font-size: 11px;">${err.code}</td>
            <td style="padding: 14px 12px; border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #475569; line-height: 1.4;">${err.description}</td>
        </tr>
    `).join('');

    const totalErrors = submissions.filter(s => s.healthStatus === "ERROR" || (s.errorCount || 0) > 0).length;
    const totalPassed = submissions.length - totalErrors;

    const sitemapSummaryTableRows = submissions.map(s => {
        const isError = s.healthStatus === "ERROR" || (s.errorCount > 0);
        const statusLabel = isError ? "❌ Failed" : "✅ Passed";
        const statusColor = isError ? "#e11d48" : "#10b981";
        const statusBg = isError ? "#fff1f2" : "#f0fdf4";
        const badgeBorder = isError ? "#ffe4e6" : "#dcfce7";

        return `
            <tr>
                <td style="padding: 20px 15px; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-family: ui-monospace, monospace; color: #1e293b; font-weight: 600; word-break: break-all; vertical-align: top;">
                    ${s.sitemapUrl}
                </td>
                <td style="padding: 20px 15px; border-bottom: 1px solid #f1f5f9; vertical-align: top; width: 110px;">
                    <span style="display: inline-block; padding: 5px 12px; border-radius: 50px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; background-color: ${statusBg}; color: ${statusColor}; border: 1px solid ${badgeBorder}; white-space: nowrap;">
                        ${statusLabel}
                    </span>
                </td>
                <td style="padding: 20px 15px; border-bottom: 1px solid #f1f5f9; font-size: 15px; font-weight: 900; color: ${isError ? '#e11d48' : '#059669'}; vertical-align: top; text-align: center;">${s.errorCount || 0}</td>
                ${totalErrors === 0 ? `
                <td style="padding: 20px 15px; border-bottom: 1px solid #f1f5f9; text-align: right; vertical-align: top;">
                    <a href="${getGSCLink(s.sitemapUrl)}" style="display: inline-block; padding: 8px 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; color: #1e293b; text-decoration: none; border-radius: 8px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; transition: all 0.2s;">
                        View in GSC
                    </a>
                </td>
                ` : ''}
            </tr>
        `;
    }).join('');

    const reportSubject = totalErrors > 0
        ? `⚠️ Sitemap Batch Report — ${totalErrors} Issue(s) Found`
        : `✅ Sitemap Batch Report — All Clear`;

    const headerGradient = totalErrors > 0 
        ? 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)' 
        : 'linear-gradient(135deg, #10b981 0%, #059669 100%)';

    const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 850px; margin: 0 auto; padding: 40px 20px; background-color: #f8fafc;">
            <div style="background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
                
                <!-- Premium Header -->
                <div style="padding: 45px 40px 30px; background: ${headerGradient}; text-align: left;">
                    <h2 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 900; letter-spacing: -0.03em; text-transform: uppercase;">Consolidated Health Report</h2>
                    <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.9); font-weight: 500;">
                        Batch analysis for <strong>${submissions.length}</strong> property sitemaps · ${checkDate}
                    </p>
                </div>

                <!-- Strategic Summary Stats -->
                <div style="display: flex; gap: 0; border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
                    <div style="flex: 1; padding: 25px; border-right: 1px solid #f1f5f9; text-align: center;">
                        <div style="font-size: 32px; font-weight: 950; color: #1e293b;">${submissions.length}</div>
                        <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 5px;">Properties</div>
                    </div>
                    <div style="flex: 1; padding: 25px; border-right: 1px solid #f1f5f9; text-align: center; background-color: ${totalPassed > 0 ? '#f0fdf4' : '#ffffff'};">
                        <div style="font-size: 32px; font-weight: 950; color: #10b981;">${totalPassed}</div>
                        <div style="font-size: 10px; font-weight: 800; color: #10b981; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 5px;">✅ Passed</div>
                    </div>
                    <div style="flex: 1; padding: 25px; text-align: center; background-color: ${totalErrors > 0 ? '#fff1f2' : '#ffffff'};">
                        <div style="font-size: 32px; font-weight: 950; color: ${totalErrors > 0 ? '#e11d48' : '#94a3b8'};">${totalErrors}</div>
                        <div style="font-size: 10px; font-weight: 800; color: ${totalErrors > 0 ? '#e11d48' : '#94a3b8'}; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 5px;">❌ Issues</div>
                    </div>
                </div>

                <!-- Deep Dive Detail Table -->
                <div style="padding: 10px;">
                    <table style="width: 100%; border-collapse: collapse; min-width: 600px;">
                        <thead>
                            <tr style="background-color: #f8fafc;">
                                <th style="padding: 15px; text-align: left; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #64748b; letter-spacing: 0.1em; border-bottom: 2px solid #f1f5f9;">Sitemap Identifier</th>
                                <th style="padding: 15px; text-align: left; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #64748b; letter-spacing: 0.1em; border-bottom: 2px solid #f1f5f9; width: 110px;">Status</th>
                                <th style="padding: 15px; text-align: center; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #64748b; letter-spacing: 0.1em; border-bottom: 2px solid #f1f5f9; width: 80px;">Issues</th>
                                ${totalErrors === 0 ? `<th style="padding: 15px; text-align: right; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #64748b; letter-spacing: 0.1em; border-bottom: 2px solid #f1f5f9; width: 120px;">Action</th>` : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${sitemapSummaryTableRows}
                        </tbody>
                    </table>
                </div>

                ${allErrorsFlattened.length > 0 ? `
                    <!-- Detailed One-By-One Breakdown -->
                    <div style="padding: 25px 35px 35px;">
                        <h3 style="font-size: 14px; font-weight: 900; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                             Detailed Issues Breakdown
                        </h3>
                        <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead style="background-color: #f8fafc;">
                                    <tr>
                                        <th style="padding: 12px; text-align: left; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Failing URL</th>
                                        <th style="padding: 12px; text-align: left; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; width: 100px;">Type</th>
                                        <th style="padding: 12px; text-align: center; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; width: 60px;">Code</th>
                                        <th style="padding: 12px; text-align: left; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Sitemap Source</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${allErrorsFlattened.map(err => `
                                        <tr>
                                            <td style="padding: 14px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; color: #1e293b; font-family: ui-monospace, monospace; word-break: break-all;">${err.url}</td>
                                            <td style="padding: 14px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
                                                <span style="display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 9px; font-weight: 800; text-transform: uppercase; background-color: #fff1f2; color: #e11d48; border: 1px solid #ffe4e6; white-space: nowrap;">
                                                    ${err.type}
                                                </span>
                                            </td>
                                            <td style="padding: 14px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; color: #64748b; font-weight: 700; text-align: center;">${err.code}</td>
                                            <td style="padding: 14px 12px; border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; font-style: italic; word-break: break-all;">${err.parentSitemap}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ` : ''}

                <!-- Footer Summary -->
                <div style="padding: 30px 40px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #94a3b8; font-weight: 600; letter-spacing: 0.02em;">
                        This consolidated report was generated via ${senderName} automation layer.
                    </p>
                     ${submissions.length > 0 ? `
                        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #f1f5f9; text-align: center;">
                            <span style="font-size: 11px; color: #cbd5e1; font-weight: 500;">
                                Average Sitemap Latency: <strong>${Math.round(submissions.reduce((acc, s) => acc + (s.responseTimeMs || 0), 0) / submissions.length)}ms</strong> 
                                · Total Nodes Scanned: ${submissions.reduce((acc, s) => acc + (s.totalUrls || 0), 0)}
                            </span>
                        </div>
                    ` : ''}
                </div>
                </div>
            </div>
        </div>
    `;

    if (provider === "Brevo") {
        const apiKey = settings?.brevoApiKey;
        if (!apiKey) return { success: false, error: "Brevo API Key missing" };

        const payload = {
            sender: { name: senderName, email: senderEmail },
            to: to.split(",").map(email => ({ email: email.trim() })).filter(e => e.email),
            subject: reportSubject,
            htmlContent: htmlContent
        };

        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "Content-Type": "application/json", "api-key": apiKey },
            body: JSON.stringify(payload)
        });

        return response.ok ? { success: true } : { success: false, error: "Brevo API failed" };
    } else {
        // EmailJS Implementation
        const serviceId = settings?.emailjsServiceId;
        const templateId = totalErrors > 0
            ? (settings?.emailjsTemplateIdFailed || settings?.emailjsTemplateIdSuccess || settings?.emailjsTemplateId)
            : (settings?.emailjsTemplateIdSuccess || settings?.emailjsTemplateId);
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
                total_errors: allErrorsFlattened.length,
                html_content: htmlContent, 
                overall_status: totalErrors > 0 ? "FAILED" : "PASSED",
                overall_status_label: totalErrors > 0 ? "❌ Issues Found" : "✅ All Clear",
                // ALIGNED 4-COLUMN ROWS FOR USER'S EMAILJS TEMPLATE
                error_rows: emailJS_error_rows || "<tr><td colspan='4' style='padding:15px; text-align:center; color:#999;'>No issues detected across all sitemaps.</td></tr>",
                response_time: submissions.length > 0 ? Math.round(submissions.reduce((acc, s) => acc + (s.responseTimeMs || 0), 0) / submissions.length) : 0,
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
