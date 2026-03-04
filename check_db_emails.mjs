
import connectDB from "./src/lib/db.js";
import User from "./src/models/User.js";
import ServiceAccount from "./src/models/ServiceAccount.js";
import dotenv from "dotenv";
dotenv.config();

async function checkData() {
    try {
        await connectDB();

        const users = await User.find({}).select("email verifiedSites").limit(5);
        console.log("Users and their verified sites:");
        users.forEach(u => {
            console.log(`User: ${u.email}`);
            console.log(`Verified Sites:`, JSON.stringify(u.verifiedSites, null, 2));
        });

        const accounts = await ServiceAccount.find({}).sort({ createdAt: -1 }).limit(5);
        console.log("\nRecent Service Accounts:");
        accounts.forEach(acc => {
            console.log(`Filename: ${acc.filename}, clientEmail: ${acc.clientEmail}, projectId: ${acc.projectId}`);
        });

        process.exit(0);
    } catch (error) {
        console.error("Check failed:", error);
        process.exit(1);
    }
}

checkData();
