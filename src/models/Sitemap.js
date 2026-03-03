import mongoose from "mongoose";

const SitemapSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    siteUrl: {
        type: String,
        required: true,
        index: true,
    },
    feedpath: {
        type: String, // The sitemap URL
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ["ACTIVE", "ERROR", "PROCESSING", "PENDING"],
        default: "PENDING",
    },
    lastCheckedAt: {
        type: Date,
    },
    errorCount: {
        type: Number,
        default: 0,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Ensure uniqueness per user/site/feedpath
SitemapSchema.index({ userId: 1, siteUrl: 1, feedpath: 1 }, { unique: true });

if (mongoose.models.Sitemap) {
    delete mongoose.models.Sitemap;
}

export default mongoose.model("Sitemap", SitemapSchema);
