import mongoose from "mongoose";

const SitemapBatchQueueSchema = new mongoose.Schema(
    {
        sitemapUrl: {
            type: String,
            required: true,
            index: true,
        },
        userEmail: {
            type: String,
            default: "",
        },
        status: {
            type: String,
            enum: ["queued", "sent"],
            default: "queued",
            index: true,
        },
        submittedAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
        healthStatus: {
            type: String,
            default: "",
        },
        errorCount: {
            type: Number,
            default: 0,
        },
        responseTimeMs: {
            type: Number,
            default: 0,
        },
        errorLogs: {
            type: [Object],
            default: [],
        },
        checkedAt: {
            type: Date,
            default: null,
        }
    },
    { timestamps: true }
);

if (mongoose.models.SitemapBatchQueue) {
    delete mongoose.models.SitemapBatchQueue;
}

export default mongoose.model("SitemapBatchQueue", SitemapBatchQueueSchema);
