import mongoose from "mongoose";

const SettingsSchema = new mongoose.Schema(
    {
        siteTitle: {
            type: String,
            default: "GSC Dashboard",
        },
        logoUrl: {
            type: String, // Store as Base64 for simplicity in this env or a path
        },
        faviconUrl: {
            type: String, // Store as Base64
        },
        logoWidth: {
            type: Number,
        },
        logoHeight: {
            type: Number,
        },
        emailProvider: {
            type: String,
            enum: ["EmailJS", "Brevo"],
            default: "EmailJS",
        },
        brevoApiKey: {
            type: String,
            default: "",
        },
        senderEmail: {
            type: String,
            default: "",
        },
        emailjsServiceId: {
            type: String,
            default: "",
        },
        emailjsTemplateId: {
            type: String,
            default: "",
        },
        emailjsTemplateIdSuccess: {
            type: String,
            default: "",
        },
        emailjsTemplateIdFailed: {
            type: String,
            default: "",
        },
        emailjsPublicKey: {
            type: String,
            default: "",
        },
        emailjsPrivateKey: {
            type: String,
            default: "",
        },
        sitemapBatchingEnabled: {
            type: Boolean,
            default: true,
        },
        sitemapLastRunDate: {
            type: Date,
            default: null,
        },
        notificationEmail: {
            type: String,
            default: "",
        },
        sitemapIsProcessing: {
            type: Boolean,
            default: false,
        },
        sitemapNextRunDate: {
            type: Date,
            default: null,
        },
        sitemapIntervalDays: {
            type: Number,
            default: 14,
        },
        sitemapStartDateTime: {
            type: Date,
            default: null,
        },
        sitemapInterval: {
            type: String,
            default: "14_DAYS",
        },
        sitemapReferenceTime: {
            type: String,
            default: "00:00",
        },
        // --- NEW REPORTING ENGINE FIELDS ---
        reportingEnabled: {
            type: Boolean,
            default: true,
        },
        reportingInterval: {
            type: String,
            default: "14_DAYS",
        },
        reportingReferenceTime: {
            type: String,
            default: "00:00",
        },
        reportingLastRunDate: {
            type: Date,
            default: null,
        },
        reportingNextRunDate: {
            type: Date,
            default: null,
        },
        reportingIsProcessing: {
            type: Boolean,
            default: false,
        },
        // Separate post-automation trigger — does NOT affect the user's configured schedule
        reportingPostAutomationRunDate: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        collection: "app_settings",
    }
);

if (mongoose.models.Settings) {
    delete mongoose.models.Settings;
}

export default mongoose.model("Settings", SettingsSchema, "app_settings");
