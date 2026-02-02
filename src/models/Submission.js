import mongoose from "mongoose";

const SubmissionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        website: {
            type: String,
            required: true,
            index: true,
        },
        url: {
            type: String,
            required: true,
        },
        action: {
            type: String,
            required: true,
            enum: ["URL_UPDATED", "URL_DELETED", "Publish", "Remove"],
        },
        statusCode: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            required: true,
            enum: ["success", "failed"],
        },
        responseMessage: {
            type: String,
        },
        rawResponse: {
            type: mongoose.Schema.Types.Mixed,
        },
        submittedAt: {
            type: Date,
            default: Date.now,
            index: true,
        }
    },
    { timestamps: true }
);

if (mongoose.models.Submission) {
    delete mongoose.models.Submission;
}

export default mongoose.model("Submission", SubmissionSchema, "submissionHistory");
