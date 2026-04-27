import mongoose from "mongoose";

const SitemapLogSchema = new mongoose.Schema(
    {
        timestamp: {
            type: Date,
            default: Date.now,
        },
        status: {
            type: String,
            enum: ["INFO", "SUCCESS", "ERROR"],
            required: true,
        },
        // "sitemap" = Sitemap Automation logs, "reporting" = Reporting Scheduler logs, "system" = Guard/system-level logs
        logCategory: {
            type: String,
            enum: ["sitemap", "reporting", "system"],
            default: "sitemap",
        },
        message: {
            type: String,
            required: true,
        },
        itemCount: {
            type: Number,
            default: 0,
        },
        details: {
            type: String,
            default: "",
        },
        items: [{
            siteUrl: String,
            sitemapUrl: String,
            healthStatus: String, // "SUCCESS" or "ERROR"
            errorCount: Number,
            message: String
        }],
    },
    {
        timestamps: true,
        collection: "sitemap_logs",
    }
);

if (mongoose.models.SitemapLog) {
    delete mongoose.models.SitemapLog;
}

export default mongoose.model("SitemapLog", SitemapLogSchema, "sitemap_logs");
