import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { BrevoClient } from "@getbrevo/brevo";

export async function POST(request) {
    const session = await auth();
    if (session?.user?.role?.toLowerCase() !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const {
            emailProvider,
            brevoApiKey,
            senderEmail,
            emailjsServiceId,
            emailjsTemplateId,
            emailjsPublicKey,
            emailjsPrivateKey
        } = body;

        const provider = emailProvider || "brevo";

        if (provider === "emailjs") {
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
                    website_link: process.env.NEXTAUTH_URL || "http://localhost:3000",
                    company_name: "GSC Dashboard Test",
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

        // Brevo Logic
        if (!brevoApiKey) {
            return NextResponse.json({ error: "Brevo API Key is required for testing" }, { status: 400 });
        }

        const client = new BrevoClient({ apiKey: brevoApiKey });
        const fromEmail = senderEmail || session.user.email;

        await client.transactionalEmails.sendTransacEmail({
            subject: "Brevo API Connection Test - Success",
            htmlContent: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #22c55e;">API Connection Successful!</h2>
                    <p>This is a test email sent from your dashboard to verify your Brevo API configuration.</p>
                    <div style="background: #f8fafc; padding: 12px; border-radius: 4px; font-size: 13px; margin: 20px 0;">
                        <strong>Tested Method:</strong> Brevo Transactional API (v4 SDK)<br/>
                        <strong>Sender:</strong> ${fromEmail}<br/>
                        <strong>Status:</strong> Active & Verified
                    </div>
                    <p style="color: #64748b; font-size: 12px;">You can now safely save this configuration in the admin dashboard.</p>
                </div>
            `,
            sender: { name: "Brevo API Test", email: fromEmail },
            to: [{ email: session.user.email }]
        });

        return NextResponse.json({ success: true, message: "Brevo API Key verified and test email sent!" });
    } catch (error) {
        console.error("Test Email Error:", error.message);
        return NextResponse.json({
            error: error.message || "Failed to send test email",
        }, { status: 500 });
    }
}
