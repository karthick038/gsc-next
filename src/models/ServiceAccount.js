import mongoose from "mongoose";

const ServiceAccountSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    filename: {
        type: String,
        required: true,
    },
    clientEmail: {
        type: String,
        required: true,
    },
    userEmail: {
        type: String,
        required: false, // Fallback to clientEmail or user.email if missing
    },
    projectId: {
        type: String,
        required: true,
    },
    encryptedJson: {
        type: String,
        required: true,
    },
    isValid: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

if (mongoose.models.ServiceAccount) {
    delete mongoose.models.ServiceAccount;
}

export default mongoose.model("ServiceAccount", ServiceAccountSchema);
