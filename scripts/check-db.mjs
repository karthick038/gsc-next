import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

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
                    // Remove quotes if present
                    if ((value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.substring(1, value.length - 1);
                    }
                    if (!process.env[key]) {
                        process.env[key] = value;
                    }
                }
            });
            fs.writeFileSync('db-debug.log', '✅ Loaded .env.local\n');
        } else {
            console.warn('⚠️ .env.local not found');
            fs.writeFileSync('db-debug.log', '⚠️ .env.local not found\n');
        }
    } catch (e) {
        console.error('⚠️ Could not load .env.local:', e);
    }
};

loadEnv();

const uri = process.env.MONGODB_URI;

if (!uri) {
    fs.appendFileSync('db-debug.log', 'MONGODB_URI is not defined\n');
    process.exit(1);
}

// Check format roughly
if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    console.error('MONGODB_URI does not start with mongodb:// or mongodb+srv://');
    console.error('Value prefix:', uri.substring(0, 15) + '...');
    process.exit(1);
}

// Mask the URI for logging
const maskedUri = uri.replace(/(:[^@]+)@/, ':****@');
fs.appendFileSync('db-debug.log', `Checking connection to: ${maskedUri}\n`);

let client;
try {
    client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
    });
} catch (e) {
    fs.appendFileSync('db-debug.log', "\n❌ URI PARSING ERROR\n");
    fs.appendFileSync('db-debug.log', `Message: ${e.message}\n`);
    process.exit(1);
}

async function run() {
    try {
        fs.appendFileSync('db-debug.log', "Attempting to connect...\n");
        await client.connect();
        fs.appendFileSync('db-debug.log', " Successfully connected to MongoDB!\n");

        await client.db('admin').command({ ping: 1 });
        fs.appendFileSync('db-debug.log', " Ping successful!\n");

    } catch (error) {
        fs.appendFileSync('db-debug.log', "\n CONNECTION FAILED\n");
        fs.appendFileSync('db-debug.log', `Message: ${error.message}\n`);
        fs.appendFileSync('db-debug.log', `Code: ${error.code}\n`);
        fs.appendFileSync('db-debug.log', `Name: ${error.name}\n`);
        if (error.cause) fs.appendFileSync('db-debug.log', `Cause: ${JSON.stringify(error.cause)}\n`);

    } finally {
        await client.close();
    }
}

run();
