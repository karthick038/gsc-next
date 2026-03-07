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
