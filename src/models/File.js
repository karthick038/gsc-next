import mongoose from "mongoose";

const FileSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    originalFileName: {
        type: String,
        required: true,
    },
    fileSize: {
        type: Number,
        required: true,
    },
    mimeType: {
        type: String,
        required: true,
        enum: ["application/json"],
    },
    fileHash: {
        type: String,
        required: true,
    },
    content: {
        type: mongoose.Schema.Types.Mixed, // Use Mixed for arbitrary JSON, or String if storing as strict string
        required: true,
    },
    uploadTimestamp: {
        type: Date,
        default: Date.now,
    },
});

// Compound index to quickly check for duplicates per user
FileSchema.index({ userId: 1, fileHash: 1 }, { unique: true });

if (mongoose.models.File) {
    delete mongoose.models.File;
}

export default mongoose.model("File", FileSchema);
