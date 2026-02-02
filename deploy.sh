#!/bin/bash

# Configuration
# Note: These are executed on your remote server.
# Ensure you are already in the project directory when this script starts (handled by GitHub Action)

echo "🚀 Starting Deployment..."

# 1. Pull the latest changes from GitHub
echo "📥 Pulling latest changes from main..."
git pull origin main

# 2. Install dependencies
# Using 'npm ci' is recommended for CI environments as it's faster and uses package-lock.json strictly
echo "📦 Installing dependencies..."
npm ci --production

# 3. Build the Next.js application
echo "🏗️ Building the application..."
npm run build

# 4. Restart the application using PM2
# Replace 'gsc-app' with your actual PM2 process name
echo "🔄 Restarting PM2 process..."
if pm2 show gsc-app > /dev/null; then
    pm2 restart gsc-app
else
    echo "⚠️ PM2 process 'gsc-app' not found. Starting a new process..."
    pm2 start npm --name "gsc-app" -- start
fi

echo "✅ Deployment Successful!"
