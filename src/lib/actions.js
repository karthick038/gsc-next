
"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function authenticate(prevState, formData) {
    try {
        const data = Object.fromEntries(formData);
        await signIn("credentials", {
            ...data,
            redirectTo: "/dashboard"
        });
    } catch (error) {
        if (error instanceof AuthError) {
            console.log("AuthError type:", error.type);
            console.log("AuthError message:", error.message);

            // Check for re-thrown errors from authorize
            const cause = error.cause?.err || error.cause || error;
            const msg = cause.message || "";

            if (msg.includes("IncorrectPassword")) {
                return "Incorrect password.";
            }

            switch (error.type) {
                case "CredentialsSignin":
                    return "Invalid credentials.";
                default:
                    return "An error occurred during sign in.";
            }
        }

        // NextAuth v5 uses redirects which throw errors. We must re-throw them.
        if (error.message === "NEXT_REDIRECT" || error.digest?.startsWith("NEXT_REDIRECT")) {
            throw error;
        }

        console.error("UNEXPECTED AUTH ERROR:", error);
        throw error;
    }
}

import connectDB from "./db";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

export async function requestPasswordReset(email) {
    try {
        await connectDB();
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return { error: "This email is not registered" };
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        user.resetOtp = otp;
        user.resetOtpExpiresAt = expiresAt;
        await user.save();

        // NodeMailer Transport
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT || "587"),
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const resetLink = `${process.env.NEXTAUTH_URL}/verify-otp?email=${encodeURIComponent(email)}`;

        await transporter.sendMail({
            from: `"Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Reset Your Password",
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #333;">Reset Your Password</h2>
                    <p>To reset your password, please use the following OTP code. This code will expire in 5 minutes.</p>
                    <div style="background: #f4f4f4; padding: 20px; text-align: center; border-radius: 5px;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #000;">${otp}</span>
                    </div>
                    <p style="margin-top: 20px;">Or click the button below to verify:</p>
                    <a href="${resetLink}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Verify OTP</a>
                    <p style="margin-top: 20px; font-size: 12px; color: #666;">If you did not request this, please ignore this email.</p>
                </div>
            `,
        });

        return { success: true };
    } catch (error) {
        console.error("Password reset request error:", error);
        return { error: "Failed to send reset email. Please try again." };
    }
}

export async function verifyOtpAction(email, otp) {
    try {
        await connectDB();
        const user = await User.findOne({
            email: email.toLowerCase(),
            resetOtp: otp,
            resetOtpExpiresAt: { $gt: new Date() }
        });

        if (!user) {
            return { error: "Invalid or expired OTP" };
        }

        return { success: true };
    } catch (error) {
        return { error: "Verification failed." };
    }
}

export async function resetPasswordAction(email, otp, newPassword) {
    try {
        await connectDB();
        const user = await User.findOne({
            email: email.toLowerCase(),
            resetOtp: otp,
            resetOtpExpiresAt: { $gt: new Date() }
        });

        if (!user) {
            return { error: "Invalid or expired session. Please start over." };
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.resetOtp = undefined;
        user.resetOtpExpiresAt = undefined;
        await user.save();

        return { success: true };
    } catch (error) {
        return { error: "Failed to reset password." };
    }
}
