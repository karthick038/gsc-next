
import connectDB from "@/lib/db";
import User from "@/models/User";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function PATCH(request) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { firstName, password } = await request.json();
        await connectDB();

        const user = await User.findById(session.user.id);
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (firstName) {
            user.firstName = firstName.trim();
        }

        if (password) {
            if (password.length < 6) {
                return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
            }
            user.password = await bcrypt.hash(password, 10);
        }

        await user.save();

        return NextResponse.json({
            success: true,
            user: {
                firstName: user.firstName,
                email: user.email,
            }
        });
    } catch (error) {
        console.error("Profile update error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
