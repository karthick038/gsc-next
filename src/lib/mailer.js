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
 * Sends a professional health check result email via EmailJS
 */
export async function sendHealthCheckEmail({
    to,
    sitemapUrl,
    status, // SUCCESS or ERROR
    summary,
    errorLogs = [],
}) {
    if (!to) return;

    const isSuccess = status === "SUCCESS";
    const checkDate = new Date().toLocaleString();

    const settings = await getEmailSettings();

    try {
        const supportEmail = settings?.senderEmail || "support@colorwhistle.com";
        const websiteLink = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const serviceId = settings?.emailjsServiceId;
        // Use status-specific template, fall back to the single generic one
        const templateId = isSuccess
            ? (settings?.emailjsTemplateIdSuccess || settings?.emailjsTemplateId)
            : (settings?.emailjsTemplateIdFailed || settings?.emailjsTemplateId);
        const publicKey = settings?.emailjsPublicKey;
        const privateKey = settings?.emailjsPrivateKey;

        if (!serviceId || !templateId || !publicKey) {
            const missingFields = [];
            if (!serviceId) missingFields.push("Service ID");
            if (!templateId) missingFields.push("Template ID");
            if (!publicKey) missingFields.push("Public Key");
            const errorData = {
                status: 0,
                statusText: "Configuration Error",
                body: `Missing EmailJS configuration: ${missingFields.join(", ")}`,
                debug: { serviceId, templateId, publicKey: publicKey ? "[SET]" : "[MISSING]", recipient: to, timestamp: new Date().toISOString() }
            };
            console.error("EmailJS config missing:", missingFields.join(", "));
            return { success: false, error: "EmailJS configuration incomplete", rawResponse: errorData };
        }

        // Format error rows for EmailJS template
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
                support_email: supportEmail,
                active_provider: "EmailJS"
            }
        };

        console.log("EmailJS Payload:", JSON.stringify({ ...payload, accessToken: "HIDDEN" }, null, 2));

        const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            const errorData = {
                status: response.status,
                statusText: response.statusText,
                body: errorText,
                debug: {
                    serviceId,
                    templateId,
                    publicKey: publicKey ? "[SET]" : "[MISSING]",
                    recipient: to,
                    timestamp: new Date().toISOString()
                }
            };
            console.error(`EmailJS Send Failed: ${response.status} - ${errorText}`);
            return { success: false, error: `EmailJS Error: ${response.status}`, rawResponse: errorData };
        }

        const successText = await response.text();
        const successData = {
            status: response.status,
            statusText: response.statusText,
            body: successText,
            debug: {
                serviceId,
                templateId,
                publicKey: publicKey ? "[SET]" : "[MISSING]",
                recipient: to,
                timestamp: new Date().toISOString()
            }
        };

        console.log(`Success email sent to ${to} via EmailJS API`);
        return { success: true, rawResponse: successData };
    } catch (err) {
        console.error("sendHealthCheckEmail - CRITICAL ERROR:", err.message);
        return { success: false, error: err.message };
    }
}
