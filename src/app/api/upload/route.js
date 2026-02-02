import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/db";
import ServiceAccount from "@/models/ServiceAccount";
import User from "@/models/User";
import { encrypt } from "@/lib/encryption";

// Helper to check auth
async function getAuthenticatedUser() {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    return null;
  }
  return session.user.id;
}

export async function GET(request) {
  try {
    const userId = await getAuthenticatedUser();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    // Return all service accounts for the user
    const accounts = await ServiceAccount.find({ userId }).sort({ createdAt: -1 });

    return NextResponse.json({
      exists: accounts.length > 0,
      accounts: accounts.map(acc => ({
        id: acc._id,
        filename: acc.filename,
        clientEmail: acc.clientEmail,
        projectId: acc.projectId,
        isValid: acc.isValid,
        createdAt: acc.createdAt
      }))
    });

  } catch (error) {
    console.error("GET Service accounts Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const userId = await getAuthenticatedUser();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Account ID required" }, { status: 400 });
    }

    await connectDB();
    const deletedAccount = await ServiceAccount.findOneAndDelete({ _id: id, userId });

    await User.findByIdAndUpdate(userId, {
      indexingStatus: "NOT_VERIFIED",
      connectedSitesCount: 0,
      sitesWithPermission: 0,
      sitesWithoutPermission: 0,
      lastConnectionTestAt: null
    });

    return NextResponse.json({ success: true, message: "Credential removed successfully" });

  } catch (error) {
    console.error("DELETE Account Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const userId = await getAuthenticatedUser();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll("file");

    if (files.length === 0) {
      return NextResponse.json({ error: "No files received." }, { status: 400 });
    }

    await connectDB();
    const results = [];

    for (const file of files) {
      if (file.type !== "application/json" && !file.name.endsWith(".json")) {
        results.push({ filename: file.name, error: "Only JSON files allowed" });
        continue;
      }

      try {
        const fileText = await file.text();
        const jsonContent = JSON.parse(fileText);

        const { client_email, private_key, project_id } = jsonContent;

        if (!client_email || !private_key || !project_id) {
          results.push({ filename: file.name, error: "Missing required fields (client_email, private_key, or project_id)" });
          continue;
        }

        const encryptedJson = encrypt(fileText);

        const newAccount = await ServiceAccount.create({
          userId,
          filename: file.name,
          clientEmail: client_email,
          projectId: project_id,
          encryptedJson,
          isValid: true
        });

        results.push({
          id: newAccount._id,
          filename: file.name,
          success: true
        });

      } catch (e) {
        results.push({ filename: file.name, error: "Invalid JSON format" });
      }
    }

    if (results.some(r => r.success)) {
      await User.findByIdAndUpdate(userId, {
        indexingStatus: "NOT_VERIFIED",
        connectedSitesCount: 0,
        sitesWithPermission: 0,
        sitesWithoutPermission: 0,
        lastConnectionTestAt: null
      });
    }

    return NextResponse.json({
      success: true,
      message: "Processing complete",
      results
    });

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
