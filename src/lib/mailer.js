import { BrevoClient } from "@getbrevo/brevo";
import connectDB from "./db";
import Settings from "@/models/Settings";

/**
 * Initializes and returns the Brevo API instance with the configured key.
 */
async function getBrevoApi() {
    await connectDB();
    const settings = await Settings.findOne({});
    const apiKey = settings?.brevoApiKey || process.env.BREVO_API_KEY;

    if (!apiKey) {
        throw new Error("Brevo API Key is not configured.");
    }

    const client = new BrevoClient({ apiKey });

    return { client, settings };
}

const APP_NAME = "Google Search Console Analytics";

/**
 * Sends a professional health check result email
 */
export async function sendHealthCheckEmail({
    to,
    sitemapUrl,
    status, // SUCCESS or ERROR
    summary,
    errors = [],
}) {
    if (!to) return;

    const isSuccess = status === "SUCCESS";
    const subject = isSuccess
        ? `Sitemap Health Check Successful`
        : `Sitemap Health Check Failed`;

    const accentColor = isSuccess ? "#22c55e" : "#ef4444";
    const checkDate = new Date().toLocaleString();

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb; }
            .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb; }
            .header { padding: 32px; background-color: #ffffff; border-bottom: 4px solid ${accentColor}; }
            .content { padding: 32px; }
            .footer { padding: 24px; text-align: center; background-color: #f8fafc; color: #64748b; font-size: 13px; }
            h1 { margin: 0; font-size: 24px; font-weight: 800; color: #111827; letter-spacing: -0.025em; }
            .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px; }
            .badge-success { background-color: #f0fdf4; color: #166534; }
            .badge-error { background-color: #fef2f2; color: #991b1b; }
            .summary-card { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0; border: 1px solid #e2e8f0; }
            .summary-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #edf2f7; }
            .summary-item:last-child { border-bottom: none; }
            .label { color: #64748b; font-weight: 500; }
            .value { color: #0f172a; font-weight: 700; }
            .error-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
            .error-table th { text-align: left; padding: 12px; background: #f8fafc; color: #64748b; border-bottom: 2px solid #e2e8f0; }
            .error-table td { padding: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
            .error-url { font-family: monospace; color: #3b82f6; word-break: break-all; }
            .btn { display: inline-block; padding: 12px 24px; background-color: #1f2937; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 24px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <span class="badge ${isSuccess ? 'badge-success' : 'badge-error'}">${status}</span>
                <h1>${subject}</h1>
            </div>
            <div class="content">
                <p>Hello,</p>
                <p>A health check has been performed for your sitemap:</p>
                <div style="background: #eff6ff; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px; color: #1d4ed8; word-break: break-all;">
                    ${sitemapUrl}
                </div>

                <div class="summary-card">
                    <div class="summary-item">
                        <span class="label">Time</span>
                        <span class="value">${checkDate}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Sitemap Accessible</span>
                        <span class="value">${summary.accessible ? '✅ Yes' : '❌ No'}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">XML Format</span>
                        <span class="value">${summary.xmlValid ? '✅ Valid' : '❌ Invalid'}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Total URLs</span>
                        <span class="value">${summary.totalUrls || 0}</span>
                    </div>
                    ${isSuccess ? `
                    <div class="summary-item">
                        <span class="label">Performance</span>
                        <span class="value">${summary.responseTimeMs}ms</span>
                    </div>
                    ` : `
                    <div class="summary-item">
                        <span class="label">Critical Issues</span>
                        <span class="value" style="color: #ef4444;">${errors.length} detected</span>
                    </div>
                    `}
                </div>

                ${!isSuccess && errors.length > 0 ? `
                <h3 style="margin-top: 32px; font-size: 16px; color: #111827;">Error Details</h3>
                <table class="error-table">
                    <thead>
                        <tr>
                            <th>URL</th>
                            <th>Error</th>
                            <th>Code</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${errors.slice(0, 10).map(err => `
                        <tr>
                            <td class="error-url">${err.url}</td>
                            <td><span style="color: #ef4444; font-weight: 600;">${err.type}</span></td>
                            <td>${err.code || '-'}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${errors.length > 10 ? `<p style="font-size: 12px; color: #64748b; margin-top: 8px;">...and ${errors.length - 10} more errors.</p>` : ''}
                
                <div style="margin-top: 32px; padding: 20px; background: #fecece1a; border-radius: 8px; border: 1px solid #fecaca;">
                    <h4 style="margin: 0 0 8px 0; color: #991b1b;">Recommended Action</h4>
                    <p style="margin: 0; font-size: 13px; color: #991b1b;">Please verify your server availability, check for broken URLs, and ensure your sitemap XML follows the standard schema. Click the button below for full diagnostics.</p>
                </div>
                ` : ''}

                <a href="${process.env.NEXTAUTH_URL}/dashboard/sitemap" class="btn">View Detailed Report</a>
            </div>
            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
                <p>This is an automated notification, please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        const { client, settings } = await getBrevoApi();

        const sender = {
            name: settings?.siteTitle || APP_NAME,
            email: settings?.smtpUser || process.env.SMTP_FROM || "notifications@gsc-dashboard.com"
        };

        await client.transactionalEmails.sendTransacEmail({
            subject,
            htmlContent: html,
            sender,
            to: [{ email: to }]
        });

        console.log(`Success email sent to ${to} via Brevo API`);
        return { success: true };
    } catch (err) {
        console.error("Failed to send email via Brevo API:", err.response?.body || err.message);
        return { success: false, error: err.response?.body?.message || err.message };
    }
}
