#!/bin/bash

echo "🚀 Starting Deployment..."

# 1️⃣ Pull the latest changes from GitHub
echo "📥 Pulling latest changes..."
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "❌ Not a git repository. Exiting."
    exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "🔹 Current branch: $CURRENT_BRANCH"

git pull origin "$CURRENT_BRANCH" || { echo "❌ git pull failed"; exit 1; }

# 2️⃣ Install dependencies
echo "📦 Installing dependencies..."
if ! command -v npm >/dev/null 2>&1; then
    echo "❌ npm is not installed. Exiting."
    exit 1
fi

npm ci --production || { echo "❌ npm install failed"; exit 1; }

# 3️⃣ Build the Next.js application
echo "🏗️ Building the application..."
npm run build || { echo "❌ npm build failed"; exit 1; }

# 4️⃣ Restart PM2 process
echo "🔄 Restarting PM2 process..."
if ! command -v pm2 >/dev/null 2>&1; then
    echo "❌ pm2 is not installed. Exiting."
    exit 1
fi

if pm2 show gsc-app >/dev/null 2>&1; then
    pm2 restart gsc-app || { echo "❌ pm2 restart failed"; exit 1; }
else
    echo "⚠️ PM2 process 'gsc-app' not found. Starting a new process..."
    pm2 start npm --name "gsc-app" -- start || { echo "❌ pm2 start failed"; exit 1; }
fi

echo "✅ Deployment Successful!"
