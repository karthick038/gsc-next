#!/bin/bash

echo "🚀 Starting Deployment..."

# ------------------------------
# Configuration
# ------------------------------
APP_NAME="gsc-app"
ECOSYSTEM_FILE="ecosystem.config.js"
PROJECT_DIR="/home/eduwhistle-gscindex/htdocs/gscindex.eduwhistle.com/gsc-next"

# ------------------------------
# Environment
# ------------------------------
export NODE_ENV=production
export NPM_CONFIG_UNSAFE_PERM=true

# ------------------------------
# Navigate to project directory
# ------------------------------
cd $PROJECT_DIR || { echo "❌ Project directory not found: $PROJECT_DIR"; exit 1; }

echo "✅ Inside project directory: $(pwd)"
echo "🔹 Listing project files"
ls -la

# ------------------------------
# Ensure git repository
# ------------------------------
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "❌ Not a git repository. Exiting."
    exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "🔹 Current branch: $CURRENT_BRANCH"

# ------------------------------
# Sync code from GitHub
# ------------------------------
echo "📥 Syncing code with GitHub..."
git fetch origin || exit 1
git reset --hard origin/$CURRENT_BRANCH || exit 1
git clean -fd || exit 1

# ------------------------------
# Clean old build and node_modules
# ------------------------------
echo "🧹 Cleaning old build and node_modules..."
rm -rf node_modules .next

# ------------------------------
# Install dependencies (local, CI/CD safe)
# ------------------------------
echo "📦 Installing dependencies..."
npm ci || { echo "❌ npm install failed"; exit 1; }

# ------------------------------
# Build the application
# ------------------------------
echo "🏗️ Building the application..."
npm run build || { echo "❌ npm build failed"; exit 1; }

# ------------------------------
# PM2 Setup / Restart (CI/CD safe)
# ------------------------------
echo "🔍 Checking PM2 ecosystem file..."
if [ ! -f "$ECOSYSTEM_FILE" ]; then
    echo "⚠️ ecosystem.config.js not found. Creating one..."
    cat <<EOF > $ECOSYSTEM_FILE
module.exports = {
  apps: [
    {
      name: "$APP_NAME",
      script: "npm",
      args: "start",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3015
      }
    }
  ]
};
EOF
fi

echo "🚀 Starting or Restarting app with PM2..."
npx pm2 restart $ECOSYSTEM_FILE || npx pm2 start $ECOSYSTEM_FILE || { echo "❌ PM2 start/restart failed"; exit 1; }

# ------------------------------
# Save PM2 process list
# ------------------------------
npx pm2 save

echo "🎉 Deployment Successful!"
