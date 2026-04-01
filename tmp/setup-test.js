const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://GSCAdmin:GSCAdmin@gsc-cluster.t0hngbr.mongodb.net/gsc-dashboard?appName=GSC-cluster";

const SettingsSchema = new mongoose.Schema({
    sitemapNextRunDate: Date,
    sitemapBatchingEnabled: { type: Boolean, default: true },
    sitemapIsProcessing: { type: Boolean, default: false }
}, { collection: 'app_settings' });

const SitemapBatchQueueSchema = new mongoose.Schema({
    sitemapUrl: String,
    status: String,
    errorCount: Number,
    healthStatus: String,
    submittedAt: Date
}, { collection: 'sitemap_batch_queue' });

const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);
const SitemapBatchQueue = mongoose.models.SitemapBatchQueue || mongoose.model('SitemapBatchQueue', SitemapBatchQueueSchema);

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB");

        // 1. Set next run to 2 minutes from now
        const nextRun = new Date(Date.now() + 120000);
        await Settings.findOneAndUpdate({}, { 
            $set: { 
                sitemapNextRunDate: nextRun,
                sitemapBatchingEnabled: true,
                sitemapIsProcessing: false
            } 
        }, { upsert: true });

        console.log("Next run scheduled for:", nextRun.toLocaleString());

        // 2. Ensure at least one sitemap with errors is in the queue
        // Check if there are any queued items
        const count = await SitemapBatchQueue.countDocuments({ status: 'queued' });
        if (count === 0) {
            await SitemapBatchQueue.create({
                sitemapUrl: "https://logowhistle.com/portfolio-sitemap.xml",
                status: "queued",
                errorCount: 14,
                healthStatus: "ERROR",
                submittedAt: new Date()
            });
            console.log("Added test sitemap with errors to the queue.");
        } else {
            console.log(`Queue already has ${count} item(s).`);
        }

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

run();
