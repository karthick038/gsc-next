import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

// Minimal env loader
const loadEnv = () => {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
            const envConfig = fs.readFileSync(envPath, 'utf8');
            envConfig.split('\n').forEach(line => {
                const lineTrim = line.trim();
                if (!lineTrim || lineTrim.startsWith('#')) return;

                const eqIdx = lineTrim.indexOf('=');
                if (eqIdx > 0) {
                    const key = lineTrim.substring(0, eqIdx).trim();
                    let value = lineTrim.substring(eqIdx + 1).trim();
                    if ((value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.substring(1, value.length - 1);
                    }
                    if (!process.env[key]) {
                        process.env[key] = value;
                    }
                }
            });
            console.log('✅ Loaded .env.local');
        }
    } catch (e) {
        console.error('⚠️ Could not load .env.local:', e);
    }
};

loadEnv();

const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error('❌ MONGODB_URI is not defined');
    process.exit(1);
}

const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db();
        const users = db.collection('users');

        const email = 'user@nextjs.com';
        const hashedPassword = await bcrypt.hash('password123', 10);

        const existingUser = await users.findOne({ email });
        if (existingUser) {
            console.log(`⚠️ User ${email} already exists.`);
        } else {
            await users.insertOne({
                email,
                password: hashedPassword,
                name: 'Test User',
                createdAt: new Date(),
            });
            console.log(`✅ User ${email} created with password "password123".`);
        }

    } catch (error) {
        console.error("❌ Seeding failed:", error);
    } finally {
        await client.close();
    }
}

run();
