
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
    {
        firstName: {
            type: String,
            required: false,
        },
        lastName: {
            type: String,
            required: false,
        },
        email: {
            type: String,
            required: [true, "Please provide an email"],
            unique: true,
        },
        password: {
            type: String,
            required: [true, "Please provide a password"],
        },
        lastLoginAt: {
            type: Date,
        },

        siteUrls: {
            type: [String],
            default: [],
        },
        verifiedSites: [{
            url: { type: String },
            status: { type: String, enum: ["SUCCESS", "ERROR"] },
            permissionLevel: { type: String },
            error: { type: String }
        }],
        indexingStatus: {
            type: String,
            enum: ["DISCONNECTED", "PARTIAL", "CONNECTED", "NOT_VERIFIED"],
            default: "NOT_VERIFIED",
        },
        lastConnectionTestAt: {
            type: Date,
        },
        connectedSitesCount: {
            type: Number,
            default: 0,
        },
        sitesWithPermission: {
            type: Number,
            default: 0,
        },
        sitesWithoutPermission: {
            type: Number,
            default: 0,
        },
        role: {
            type: String,
            enum: ["admin", "user"],
            default: "user",
        },
    },
    {
        timestamps: true,
        collection: "login_users",
    }
);

if (mongoose.models.User) {
    delete mongoose.models.User;
}

if (mongoose.models.User) {
    delete mongoose.models.User;
}

export default mongoose.model("User", UserSchema, "login_users");
