#!/bin/bash
set -e

echo "🚀 Starting Next.js deployment..."

APP_DIR="/home/eduwhistle-gscanalytics/htdocs/gscanalytics.eduwhistle.com"
BRANCH="gsc-next"
PM2_APP="gsc-next"
PORT="3021"

cd "$APP_DIR"

# Ensure git trust
git config --global --add safe.directory "$APP_DIR"

echo "📌 Current commit:"
git log -1 --oneline || true

echo "⬇️ Fetching latest code..."
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "📌 Updated commit:"
git log -1 --oneline

echo "📦 Installing dependencies..."
npm install

echo "🏗️ Building Next.js app..."
npm run build

echo "♻️ Restarting PM2..."
pm2 restart "$PM2_APP" || PORT=$PORT pm2 start npm --name "$PM2_APP" -- start

pm2 save

echo "✅ Deployment completed successfully!"
