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
        const { brevoApiKey, senderEmail } = body;

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

        return NextResponse.json({ success: true, message: "API Key verified and test email sent!" });
    } catch (error) {
        console.error("Brevo API Test Error:", error.response?.body || error.message);
        return NextResponse.json({
            error: error.response?.body?.message || error.message || "Failed to connect to Brevo API",
        }, { status: 500 });
    }
}
