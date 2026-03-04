import mongoose from "mongoose";

const HealthCheckLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    sitemapId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Sitemap",
        required: true,
        index: true,
    },
    feedpath: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ["SUCCESS", "ERROR"],
        required: true,
    },
    summary: {
        totalUrls: Number,
        okCount: Number,
        redirectCount: Number,
        errorCount: Number,
        responseTimeMs: Number,
        xmlValid: Boolean,
        accessible: Boolean,
    },
    errorLogs: [
        {
            url: String,
            type: String, // 404, 500, Timeout, etc.
            code: Number,
            description: String,
        }
    ],
    emailResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    checkedAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
});

if (mongoose.models.HealthCheckLog) {
    delete mongoose.models.HealthCheckLog;
}

export default mongoose.model("HealthCheckLog", HealthCheckLogSchema);
