const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

const UserSchema = new Schema({
    name: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    authProviderId: { type: String },
}, { timestamps: true });

// Check if model exists to avoid recompilation error
const User = mongoose.models?.User || mongoose.model("User", UserSchema, "login_users");

async function createTestUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to DB");

        const hashedPassword = await bcrypt.hash("password123", 10);

        await User.findOneAndUpdate(
            { email: "test@example.com" },
            {
                name: "Test User",
                email: "test@example.com",
                password: hashedPassword
            },
            { upsert: true, new: true }
        );

        console.log("Test user created: test@example.com / password123");
        await mongoose.disconnect();
    } catch (e) {
        console.error("Error:", e);
    }
}

createTestUser();
