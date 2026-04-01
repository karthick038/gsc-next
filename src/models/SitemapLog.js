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
