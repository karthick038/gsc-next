import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST(request) {
    const session = await auth();
    if (session?.user?.role?.toLowerCase() !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const {
            emailProvider,
            emailjsServiceId,
            emailjsTemplateId,
            emailjsPublicKey,
            emailjsPrivateKey,
            brevoApiKey,
            senderEmail,
            siteTitle
        } = body;

        const provider = emailProvider || "EmailJS";

        if (provider === "Brevo") {
            if (!brevoApiKey) {
                return NextResponse.json({ error: "Brevo API Key is required" }, { status: 400 });
            }

            const payload = {
                sender: { name: siteTitle || "GSC Dashboard Test", email: senderEmail || session.user.email },
                to: [{ email: session.user.email }],
                subject: "Brevo Connection Test - GSC Analytics",
                htmlContent: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                        <h2 style="color: #1a365d;">Connection Successful!</h2>
                        <p>This is a test email from your GSC Dashboard to verify your <strong>Brevo</strong> configuration.</p>
                        <p style="font-size: 12px; color: #666;">Timestamp: ${new Date().toLocaleString()}</p>
                    </div>
                `
            };

            const response = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "api-key": brevoApiKey
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Brevo Error: ${errorData.message || response.statusText}`);
            }

            return NextResponse.json({ success: true, message: "Brevo API Key verified and test email sent!" });
        } else {
            // EmailJS Logic
            if (!emailjsServiceId || !emailjsPublicKey) {
                return NextResponse.json({ error: "EmailJS Service ID and Public Key are required" }, { status: 400 });
            }

            const payload = {
                service_id: emailjsServiceId,
                template_id: emailjsTemplateId || "template_ds18osi",
                user_id: emailjsPublicKey,
                accessToken: emailjsPrivateKey,
                template_params: {
                    to_email: session.user.email,
                    from_name: siteTitle || "GSC Dashboard Test",
                    website_link: process.env.NEXTAUTH_URL || "http://localhost:3000",
                    company_name: siteTitle || "GSC Dashboard Test",
                    sitemap_url: "https://example.com/sitemap.xml",
                    checked_time: new Date().toLocaleString(),
                    total_urls: 1,
                    total_errors: 0,
                    error_rows: "<tr><td colspan='4' style='padding:8px; text-align:center;'>This is a test connection email.</td></tr>",
                    support_email: senderEmail || session.user.email
                }
            };

            const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`EmailJS Error: ${response.status} - ${errorText}`);
            }

            return NextResponse.json({ success: true, message: "EmailJS credentials verified and test email sent!" });
        }
    } catch (error) {
        console.error("Test Email Error:", error.message);
        return NextResponse.json({
            error: error.message || "Failed to send test email",
        }, { status: 500 });
    }
}
