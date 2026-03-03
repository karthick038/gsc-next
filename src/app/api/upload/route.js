import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/db";
import ServiceAccount from "@/models/ServiceAccount";
import User from "@/models/User";
import Submission from "@/models/Submission";
import WebsiteQuota from "@/models/WebsiteQuota";
import { encrypt, decrypt } from "@/lib/encryption";
import { google } from "googleapis";

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

    if (!deletedAccount) {
      return NextResponse.json({ error: "Account not found or unauthorized" }, { status: 404 });
    }

    // --- CASCADE RE-VALIDATION ---
    // When a credential is removed, we must check if the remaining credentials 
    // still provide access to the currently connected sites.
    const remainingAccounts = await ServiceAccount.find({ userId });
    const user = await User.findById(userId);

    if (user) {
      const permissionMap = new Map(); // siteUrl -> permissionLevel

      // 1. Build a map of ALL sites accessible by ANY remaining service account
      for (const acc of remainingAccounts) {
        try {
          const decryptedText = decrypt(acc.encryptedJson);
          if (!decryptedText) continue;

          const credentials = JSON.parse(decryptedText);
          const authClient = new google.auth.GoogleAuth({
            credentials: {
              client_email: credentials.client_email,
              private_key: credentials.private_key,
            },
            scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
          });

          const searchConsole = google.searchconsole({ version: "v1", auth: authClient });
          const sitesRes = await searchConsole.sites.list();
          const sitesList = sitesRes.data.siteEntry || [];

          sitesList.forEach(s => {
            const normalized = s.siteUrl.toLowerCase().replace(/\/$/, "");
            const existing = permissionMap.get(normalized);
            // siteOwner has priority
            if (!existing || s.permissionLevel === "siteOwner") {
              permissionMap.set(normalized, s.permissionLevel);
            }
          });
        } catch (err) {
          console.error(`Cleanup re-validation failed for ${acc.filename}:`, err.message);
        }
      }

      // 2. Filter user.verifiedSites to only include those still accessible
      const originalVerifiedSites = [...(user.verifiedSites || [])];
      user.verifiedSites = originalVerifiedSites.filter(site => {
        const normalizedUserUrl = site.url.toLowerCase().replace(/\/$/, "").replace(/^https?:\/\//, "").replace(/^www\./, "");

        let hasAccess = false;
        for (const [gSite, perm] of permissionMap.entries()) {
          const normalizedGSite = gSite.replace(/^sc-domain:/, "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
          if (normalizedGSite === normalizedUserUrl) {
            site.permissionLevel = perm; // Update permission level
            hasAccess = true;
            break;
          }
        }
        return hasAccess;
      });

      // --- DATABASE PURGE ---
      // For any site that lost access, delete its history and quotas
      const removedSites = originalVerifiedSites.filter(
        oldSite => !user.verifiedSites.some(newSite => newSite.url === oldSite.url)
      );

      for (const site of removedSites) {
        console.log(`Purging quotas for disconnected site: ${site.url}`);
        // History is preserved as per user requirement. Only quotas are reset.
        await WebsiteQuota.deleteMany({ userId, website: site.url });
      }

      // 3. Update User meta counts and status
      const totalConnected = user.verifiedSites.length;
      user.connectedSitesCount = totalConnected;
      user.sitesWithPermission = totalConnected;
      user.sitesWithoutPermission = 0;

      if (totalConnected === 0) {
        user.indexingStatus = "DISCONNECTED";
      } else if (totalConnected < originalVerifiedSites.length) {
        user.indexingStatus = (totalConnected === (user.siteUrls?.length || 0)) ? "CONNECTED" : "PARTIAL";
      }

      user.lastConnectionTestAt = new Date();
      await user.save();
    }

    return NextResponse.json({
      success: true,
      message: "Credential removed and site connections updated",
      totalRemainingSites: user ? user.connectedSitesCount : 0,
      removedSitesCount: user ? (originalVerifiedCount - totalConnected) : 0
    });

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
    const customEmail = formData.get("customEmail");

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
          clientEmail: customEmail || client_email,
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
