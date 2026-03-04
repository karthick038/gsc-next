
const { sendHealthCheckEmail } = require("./src/lib/mailer");
const mongoose = require("mongoose");
require("dotenv").config();

async function testEmail() {
    try {
        console.log("Starting email test...");

        // Mock data
        const testData = {
            to: "karthickbharathi.colorwhistle@gmail.com", // User's email from context
            sitemapUrl: "https://example.com/sitemap.xml",
            status: "ERROR",
            summary: {
                accessible: true,
                xmlValid: true,
                totalUrls: 42,
                errorCount: 2
            },
            errorLogs: [
                { url: "https://example.com/page1", type: "404 Not Found", description: "The page does not exist." },
                { url: "https://example.com/page2", type: "500 Server Error", description: "Internal server error occurred." }
            ]
        };

        const result = await sendHealthCheckEmail(testData);
        console.log("Email test result:", result);

        process.exit(0);
    } catch (error) {
        console.error("Test failed:", error);
        process.exit(1);
    }
}

testEmail();
