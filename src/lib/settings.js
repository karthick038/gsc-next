
import connectDB from "@/lib/db";
import Settings from "@/models/Settings";

export async function getSettings() {
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
        // Convert to plain object for Next.js Server Components
        return JSON.parse(JSON.stringify(settings));
    } catch (error) {
        console.error("Error fetching settings:", error);
        return {
            siteTitle: "GSC Dashboard",
            logoUrl: "/images/branding/colorwhistle-logo.png",
            faviconUrl: "/favicon.ico"
        };
    }
}
