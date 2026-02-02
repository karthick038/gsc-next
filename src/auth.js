
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import connectDB from "./lib/db";
import User from "./models/User";
import bcrypt from "bcryptjs";

export const { auth, signIn, signOut, handlers } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                if (!process.env.MONGODB_URI) {
                    console.error("Missing MONGODB_URI");
                    throw new Error("Missing MONGODB_URI");
                }
                if (!process.env.AUTH_SECRET) {
                    console.error("Missing AUTH_SECRET (npx auth secret)");
                    // NextAuth v5 requires this, usually throws if missing but good to check
                }

                try {
                    if (!credentials?.email || !credentials?.password) return null;
                    const email = credentials.email.toString().toLowerCase().trim();
                    const password = credentials.password;

                    console.log("Attempting login for:", email);
                    await connectDB();
                    console.log("MongoDB Connected");

                    const ADMIN_EMAIL = "admin@colorwhistle.com";
                    const ADMIN_PASSWORD = "admincw";

                    // Hardcoded Admin Check
                    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
                        console.log("Admin credentials detected");
                        let adminUser = await User.findOne({ email: ADMIN_EMAIL });
                        if (!adminUser) {
                            console.log("Creating admin user in database...");
                            const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
                            adminUser = new User({
                                email: ADMIN_EMAIL,
                                password: hashedPassword,
                                firstName: "Admin",
                                lastName: "CW",
                                role: "admin",
                                lastLoginAt: new Date(),
                            });
                            await adminUser.save();
                        } else if (adminUser.role !== "admin") {
                            adminUser.role = "admin";
                            await adminUser.save();
                        }

                        return {
                            id: adminUser._id.toString(),
                            email: adminUser.email,
                            firstName: adminUser.firstName,
                            role: "admin",
                        };
                    }

                    let user = await User.findOne({ email });
                    console.log("Search result for", email, ":", user ? "User exists" : "User not found");

                    if (!user) {
                        console.log("Login attempt for non-existent user:", email);
                        return null; // Don't create account, just fail login
                    } else {
                        console.log("Validating password for existing user...");
                        const passwordsMatch = await bcrypt.compare(password, user.password);
                        if (!passwordsMatch) {
                            console.log("Password mismatch for", email);
                            throw new Error("IncorrectPassword");
                        }

                        user.lastLoginAt = new Date();
                        await user.save();
                        console.log("Password validated and lastLoginAt updated");
                    }

                    // Return plain clean object
                    return {
                        id: user._id.toString(),
                        email: user.email,
                        firstName: user.firstName,
                        role: user.role || "user",
                    };
                } catch (error) {
                    if (error.message === "IncorrectPassword") {
                        console.log("Re-throwing IncorrectPassword for action handler");
                        throw error;
                    }
                    console.error("CRITICAL AUTH ERROR:", error);
                    // Temporarily throw the error message so we can see it in the UI
                    throw new Error(`DEBUG_AUTH_FAIL: ${error.message}`);
                }
            },
        }),
    ],
});
