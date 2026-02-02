# GSC Indexing Dashboard

A modern, high-performance dashboard built with Next.js and MongoDB for managing Google Search Console indexing requests efficiently.

## 🚀 Features
- **Secure Authentication**: NextAuth.js integration with MongoDB adapter.
- **Bulk Indexing**: Submit up to 100 URLs at once via manual entry or CSV upload.
- **Real-time Validation**: Instant feedback on URL domain matching and limits.
- **Custom Branding**: Manage your dashboard logo, favicon, and site title directly from the settings.
- **Role-Based Access**: Specialized views for Admins and regular users.

## 🛠 Tech Stack
- **Framework**: Next.js 15+ (App Router)
- **Database**: MongoDB (Mongoose)
- **Auth**: NextAuth.js
- **Styling**: Tailwind CSS & Shadcn UI
- **Icons**: Lucide React

## 📦 Getting Started

### Prerequisites
- Node.js 18.x or later
- MongoDB Atlas account (free tier works great)
- Google Cloud Platform Service Account with Indexing API enabled

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/your-repo-name.git
   cd your-repo-name
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env.local` and fill in your credentials.
   ```bash
   cp .env.example .env.local
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

## 🔐 Security Best Practices
- **Environment Variables**: Never commit your `.env.local` file. It is ignored by Git by default.
- **Secret Rotation**: If you accidentally commit a secret, rotate it immediately in the provider (MongoDB Atlas, Google Cloud).
- **Safe Pushes**: Use `git status` before pushing to ensure no sensitive files are staged.

## 🚀 CI/CD Deployment
This repository is configured with GitHub Actions for automatic deployment via SSH.

### GitHub Secrets Configuration
To enable automatic deployments, add the following secrets to your GitHub repository (**Settings > Secrets and variables > Actions**):

| Secret Name | Description |
| :--- | :--- |
| `SSH_HOST` | The IP address or hostname of your production server. |
| `SSH_USERNAME` | The SSH username (e.g., `ubuntu`, `root`). |
| `SSH_PRIVATE_KEY` | Your SSH private key (content of `id_rsa`). |
| `SSH_PORT` | The SSH port (usually `22`). |
| `DEPLOY_PATH` | The absolute path to the project on your server (e.g., `/var/www/gsc-app`). |

### How it works
1. When you push to the `main` branch, GitHub Actions triggers the deployment workflow.
2. The runner connects to your server via SSH.
3. It executes `deploy.sh`, which pulls the latest code, installs production dependencies, builds the app, and restarts the PM2 process.

## 📄 License
MIT
