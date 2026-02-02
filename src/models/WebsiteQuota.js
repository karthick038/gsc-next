import mongoose from "mongoose";

const WebsiteQuotaSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    website: {
        type: String,
        required: true,
    },
    date: {
        type: String, // YYYY-MM-DD
        required: true,
    },
    used: {
        type: Number,
        default: 0,
    },
    limit: {
        type: Number,
        default: 200,
    },
    lastUpdated: {
        type: Date,
        default: Date.now,
    },
});

// Compound unique index for userId + website + date ensures clean daily buckets per user
WebsiteQuotaSchema.index({ userId: 1, website: 1, date: 1 }, { unique: true });

if (mongoose.models.WebsiteQuota) {
    delete mongoose.models.WebsiteQuota;
}

export default mongoose.model("WebsiteQuota", WebsiteQuotaSchema);
