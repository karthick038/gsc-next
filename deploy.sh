#!/bin/bash

echo "🚀 Starting Deployment..."

APP_NAME="gsc-app"
ECOSYSTEM_FILE="ecosystem.config.js"

# Set production env
export NODE_ENV=production
export NPM_CONFIG_UNSAFE_PERM=true

# Ensure git repo
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "❌ Not a git repository. Exiting."
    exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "🔹 Current branch: $CURRENT_BRANCH"

# Sync code
echo "📥 Syncing code with GitHub..."
git fetch origin || exit 1
git reset --hard origin/$CURRENT_BRANCH || exit 1
git clean -fd || exit 1

# Optional: fix permissions
echo "🔧 Fixing project folder permissions..."
chown -R $(whoami):$(whoami) .

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --unsafe-perm || { echo "❌ npm install failed"; exit 1; }

# Build
echo "🏗️ Building the application..."
npm run build || { echo "❌ npm build failed"; exit 1; }

# PM2
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
    pm2 start $ECOSYSTEM_FILE || { echo "❌ PM2 start failed"; exit 1; }
else
    pm2 restart $ECOSYSTEM_FILE || pm2 start $ECOSYSTEM_FILE || { echo "❌ PM2 restart/start failed"; exit 1; }
fi

# Save PM2
pm2 save

echo "🎉 Deployment Successful!"
