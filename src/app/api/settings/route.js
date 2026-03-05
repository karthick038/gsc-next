import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Settings from "@/models/Settings";
import { auth } from "@/auth";

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
        return NextResponse.json(settings);
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
            senderEmail,
            emailjsServiceId, emailjsTemplateId, emailjsTemplateIdSuccess, emailjsTemplateIdFailed,
            emailjsPublicKey, emailjsPrivateKey
        } = body;

        await connectDB();
        const updatedSettings = await Settings.findOneAndUpdate(
            {},
            {
                siteTitle, logoUrl, faviconUrl, logoWidth, logoHeight,
                senderEmail,
                emailjsServiceId, emailjsTemplateId, emailjsTemplateIdSuccess, emailjsTemplateIdFailed,
                emailjsPublicKey, emailjsPrivateKey
            },
            { upsert: true, new: true }
        );

        return NextResponse.json(updatedSettings);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
