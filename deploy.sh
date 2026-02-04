#!/bin/bash

echo "🚀 Starting Deployment..."

# 1️⃣ Ensure git repo
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "❌ Not a git repository. Exiting."
    exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "🔹 Current branch: $CURRENT_BRANCH"

# 2️⃣ Force sync with GitHub (NO MERGES)
echo "📥 Syncing code with GitHub..."
git fetch origin || exit 1
git reset --hard origin/$CURRENT_BRANCH || exit 1
git clean -fd || exit 1

# 3️⃣ Install dependencies
echo "📦 Installing dependencies..."
npm ci || { echo "❌ npm install failed"; exit 1; }

# 4️⃣ Build
echo "🏗️ Building the application..."
npm run build || { echo "❌ npm build failed"; exit 1; }

# 5️⃣ Restart PM2
echo "🔄 Restarting PM2..."
if pm2 show gsc-app >/dev/null 2>&1; then
    pm2 restart gsc-app
else
    pm2 start npm --name "gsc-app" -- start
fi

pm2 save

echo "Deployment Successful!"
