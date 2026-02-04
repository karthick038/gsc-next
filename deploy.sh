#!/bin/bash

echo "🚀 Starting Deployment..."

APP_NAME="gsc-app"
ECOSYSTEM_FILE="ecosystem.config.js"

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

# 5️⃣ PM2 ecosystem file check
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

    echo "✅ ecosystem.config.js created"
    echo "🚀 Starting app with PM2..."
    pm2 start $ECOSYSTEM_FILE

else
    echo "✅ ecosystem.config.js exists"
    echo "🔄 Restarting app with PM2..."
    pm2 restart $ECOSYSTEM_FILE
fi

# 6️⃣ Save PM2 state
pm2 save

echo "🎉 Deployment Successful!"
