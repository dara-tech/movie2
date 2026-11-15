# Netlify Auto-Deployment Setup Guide

This guide will help you set up automatic deployment of the client to Netlify from your Git repository.

## Prerequisites

1. A Git repository (GitHub, GitLab, or Bitbucket)
2. A Netlify account (free tier works)
3. Your code pushed to the repository

## Step-by-Step Setup

### 1. Push Your Code to Git

Make sure your code is pushed to your Git repository:

```bash
git add .
git commit -m "Add Netlify configuration"
git push origin main  # or master, depending on your default branch
```

### 2. Connect Netlify to Your Repository

1. Go to [Netlify](https://app.netlify.com/)
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose your Git provider (GitHub, GitLab, or Bitbucket)
4. Authorize Netlify to access your repositories
5. Select your repository
6. Select the branch (usually `main` or `master`)

### 3. Configure Build Settings

Netlify will auto-detect settings from `netlify.toml`, but verify:

- **Base directory**: `client`
- **Build command**: `npm install --legacy-peer-deps && npm run build`
- **Publish directory**: `client/build`

Or manually set in Netlify dashboard:
- **Base directory**: `client`
- **Build command**: `npm install --legacy-peer-deps && npm run build`
- **Publish directory**: `build`

### 4. Set Environment Variables

In Netlify dashboard → Site settings → Environment variables, add:

```
REACT_APP_API_URL=https://your-backend-server.com
SITE_URL=https://your-netlify-site.netlify.app
```

### 5. Deploy

1. Click **"Deploy site"**
2. Netlify will automatically:
   - Install dependencies
   - Run the build command
   - Deploy the built files
   - Provide you with a URL (e.g., `https://your-site.netlify.app`)

### 6. Configure Custom Domain (Optional)

1. Go to **Site settings** → **Domain management**
2. Click **"Add custom domain"**
3. Enter your domain (e.g., `moviestream.cc`)
4. Follow DNS configuration instructions

## Automatic Deployments

Once set up:
- **Every push to main/master** → Automatic deployment
- **Pull requests** → Preview deployments (optional)
- **Manual deployments** → Available in Netlify dashboard

## Build Status

You can check build status:
- In Netlify dashboard
- Via deploy notifications (email/Slack)
- Build logs are available for debugging

## Troubleshooting

### Build Fails

1. Check build logs in Netlify dashboard
2. Ensure `base = "client"` is set correctly
3. Verify Node version (should be 18)
4. Check environment variables are set

### Environment Variables Not Working

- Make sure variables start with `REACT_APP_` for client-side access
- Redeploy after adding/updating variables

### Build Timeout

- Netlify free tier: 15 minutes max
- If build takes too long, optimize dependencies or upgrade plan

## File Structure

```
your-repo/
├── netlify.toml          # Root Netlify config (uses client/ as base)
├── client/
│   ├── netlify.toml      # Alternative: client-specific config
│   ├── package.json
│   └── build/            # Generated on build (gitignored)
└── server/               # Not deployed to Netlify
```

## Notes

- The `build/` folder is gitignored and will be generated on Netlify
- The server runs separately (not on Netlify)
- Only the client React app is deployed to Netlify
- Environment variables must be set in Netlify dashboard for production

