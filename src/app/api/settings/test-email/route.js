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
            emailjsServiceId,
            emailjsTemplateId,
            emailjsPublicKey,
            emailjsPrivateKey,
            senderEmail
        } = body;

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
    } catch (error) {
        console.error("Test Email Error:", error.message);
        return NextResponse.json({
            error: error.message || "Failed to send test email",
        }, { status: 500 });
    }
}
