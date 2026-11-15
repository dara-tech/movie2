# Cache Fix Guide

## Problem
Users experiencing blank screen with errors like:
- `SyntaxError: Unexpected token '<'`
- `Did not parse stylesheet because non CSS MIME types are not allowed`

This happens when browser cache serves old JavaScript/CSS files after a new deployment.

## Solution Implemented

### 1. Service Worker Updates
- Updated to version-based cache (`v2`)
- Automatically deletes ALL old caches on activation
- Network-first strategy for HTML files
- Automatic page reload when new service worker activates

### 2. Netlify Headers
- `/static/js/*` and `/static/css/*` - Cached for 1 year (safe because they have hash in filename)
- `/sw.js` - No cache (always fetched fresh)
- `/index.html` - No cache (always fetched fresh)
- Other JS/CSS files - No cache

### 3. Service Worker Registration
- Checks for updates every hour
- Automatically reloads page when new version is available
- Uses `updateViaCache: 'none'` to always check for updates

## How to Clear Cache (For Users)

### Option 1: Hard Refresh (Recommended)
- **Chrome/Edge**: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- **Firefox**: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)
- **Safari**: `Cmd+Option+R` (Mac)

### Option 2: Clear Browser Cache
1. Open browser settings
2. Go to Privacy/Security
3. Clear browsing data
4. Select "Cached images and files"
5. Clear data

### Option 3: Clear Service Worker
1. Open DevTools (F12)
2. Go to Application tab
3. Click "Service Workers" in left sidebar
4. Click "Unregister" for any registered service workers
5. Go to "Storage" → "Clear site data"
6. Refresh the page

## For Developers

### Increment Cache Version on Each Deployment
When deploying a new version, update the `CACHE_VERSION` in `client/public/sw.js`:
```javascript
const CACHE_VERSION = 'v3'; // Increment this number
```

### Testing Cache Issues Locally
1. Build the app: `npm run build`
2. Serve with a simple HTTP server
3. Test with different cache settings

## Prevention
- Always increment `CACHE_VERSION` in `sw.js` when deploying
- The service worker will automatically clear old caches
- Users will get automatic updates within 1 hour

