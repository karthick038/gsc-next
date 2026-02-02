
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";

export async function GET() {
    const session = await auth();
    const role = session?.user?.role?.toLowerCase();
    const isAdmin = role === "admin";

    if (!isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await connectDB();
        const curId = session?.user?.id || session?.user?._id;
        const users = await User.find({}).sort({ createdAt: -1 });

        const decoratedUsers = users.map(user => ({
            ...user.toObject(),
            isCurrentUser: curId && String(user._id) === String(curId)
        }));

        return NextResponse.json(decoratedUsers);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await auth();
    const role = session?.user?.role?.toLowerCase();
    const isAdmin = role === "admin";

    if (!isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { firstName, email, password, role: requestedRole } = await request.json();

        if (!firstName || !email || !password) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        await connectDB();

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return NextResponse.json({ error: "User already exists" }, { status: 400 });
        }

        let userRole = "user";
        if (requestedRole) {
            if (!["admin", "user"].includes(requestedRole)) {
                return NextResponse.json({ error: "Invalid role" }, { status: 400 });
            }
            userRole = requestedRole;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            firstName,
            email: email.toLowerCase(),
            password: hashedPassword,
            role: userRole,
        });

        await newUser.save();

        return NextResponse.json(newUser, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request) {
    const session = await auth();
    const role = session?.user?.role?.toLowerCase();
    const isAdmin = role === "admin";

    if (!isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { userId, firstName, password, role } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        await connectDB();
        const user = await User.findById(userId);

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Prevent self-demotion from admin (simplified)
        if (user.id === session.user.id && session.user.role === "admin" && role && role !== "admin") {
            return NextResponse.json({ error: "Administrators cannot demote themselves" }, { status: 400 });
        }

        if (firstName) user.firstName = firstName;
        if (password) {
            if (password.length < 6) {
                return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
            }
            user.password = await bcrypt.hash(password, 10);
        }
        if (role) {
            if (!["admin", "user"].includes(role)) {
                return NextResponse.json({ error: "Invalid role" }, { status: 400 });
            }
            user.role = role;
        }

        await user.save();
        return NextResponse.json(user);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    const session = await auth();
    const role = session?.user?.role?.toLowerCase();
    const isAdmin = role === "admin";

    if (!isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        if (userId === session.user.id) {
            return NextResponse.json({ error: "You cannot delete yourself" }, { status: 400 });
        }

        await connectDB();

        await User.findByIdAndDelete(userId);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
