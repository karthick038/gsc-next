import mongoose from "mongoose";

const UserQuotaSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        date: {
            type: String, // YYYY-MM-DD
            required: true,
            index: true,
        },
        usedCount: {
            type: Number,
            default: 0,
        },
        limit: {
            type: Number,
            default: 200,
        },
    },
    { timestamps: true }
);

// Compound index to ensure one quota record per user per day
UserQuotaSchema.index({ userId: 1, date: 1 }, { unique: true });

if (mongoose.models.UserQuota) {
    delete mongoose.models.UserQuota;
}

export default mongoose.model("UserQuota", UserQuotaSchema);
