# Netlify Environment Variables

## Required Environment Variables

Set these in Netlify Dashboard → Site settings → Environment variables

### 1. Backend API URL (REQUIRED)
```
REACT_APP_API_URL=https://movie-7zq4.onrender.com
```
- This is your backend server URL
- Used by the React app to make API calls
- Used by the sitemap-proxy function to fetch sitemap from backend

### 2. Site URL (OPTIONAL but recommended)
```
REACT_APP_SITE_URL=https://moviestream.cc
```
- Used for SEO meta tags
- Should match your production domain

### 3. TMDB API Key (OPTIONAL - only if you use TMDB features)
```
REACT_APP_TMDB_API_KEY=your_tmdb_api_key_here
```
- Only needed if your frontend directly calls TMDB API
- Get from: https://www.themoviedb.org/settings/api

## How to Set in Netlify

1. Go to Netlify Dashboard
2. Select your site
3. Go to **Site settings** → **Environment variables**
4. Click **Add variable**
5. Add each variable:
   - **Key**: `REACT_APP_API_URL`
   - **Value**: `https://movie-7zq4.onrender.com`
   - **Scopes**: Select "All scopes" or "Production, Deploy previews, Branch deploys"
6. Repeat for other variables
7. Click **Save**

## Important Notes

- **REACT_APP_** prefix is required for React to access these variables
- After adding variables, you need to **trigger a new deploy** for changes to take effect
- Variables are available at build time and runtime
- The sitemap-proxy function uses `REACT_APP_API_URL` to know where your backend is

## Current Setup

Based on your code:
- Backend: `https://movie-7zq4.onrender.com`
- Frontend: `https://moviestream.cc`
- Sitemap: Uses static file (no env vars needed for sitemap itself)

## Quick Setup (Minimum Required)

If you only want the basics working:

```
REACT_APP_API_URL=https://movie-7zq4.onrender.com
```

That's it! This is the minimum needed for your app to work.


