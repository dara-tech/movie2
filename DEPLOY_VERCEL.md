# Deploy client to Vercel

This guide gets the **client** (React app in `client/`) live on Vercel with sitemaps and SPA routing working.

---

## 1. Push your code

Ensure your latest code (including `client/vercel.json` and `client/api/sitemap-proxy.js`) is pushed to GitHub/GitLab/Bitbucket.

---

## 2. Create a Vercel project

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub/GitLab/Bitbucket).
2. Click **Add New…** → **Project**.
3. **Import** the same Git repository you use for this app.
4. Before deploying, set the **Root Directory**:
   - Click **Edit** next to “Root Directory”.
   - Enter **`client`** and confirm.
   - Vercel will treat `client` as the project root (build, `vercel.json`, `api/`).

---

## 3. Build settings (optional)

Vercel usually detects Create React App. The repo already has `client/vercel.json` with:

- **Build Command:** `npm run build`
- **Output Directory:** `build`
- **Install Command:** `npm install --legacy-peer-deps`

If you need to set them manually:

- **Framework Preset:** Create React App (or “Other”).
- **Root Directory:** `client`.
- **Build Command:** `npm run build`.
- **Output Directory:** `build`.
- **Install Command:** `npm install --legacy-peer-deps`.

---

## 4. Environment variables

In the project: **Settings → Environment Variables**.

Add any variables the client needs at build or runtime, for example:

| Name                 | Value                               | Notes                    |
|----------------------|-------------------------------------|--------------------------|
| `REACT_APP_API_URL`  | `https://movie-7zq4.onrender.com`   | Backend + sitemap proxy  |

Apply to **Production** (and Preview if you want the same there). Redeploy after changing env vars.

---

## 5. Deploy

- Click **Deploy**.
- Vercel will run `npm install --legacy-peer-deps` and `npm run build` inside `client/`, then serve the `build` folder and the API route.

Your app will be available at a `*.vercel.app` URL. After that you can add a custom domain (e.g. moviestream.cc or freemovie.online) in **Settings → Domains**.

---

## 6. What’s configured in this repo

- **`client/vercel.json`**
  - Build and install commands, rewrites, and cache headers.
  - Sitemap URLs (`/sitemap.xml`, `/sitemaps.xml`, `/sitemap_index.xml`, `/sitemap-movies.xml`, etc.) are rewritten to **`/api/sitemap-proxy`** so the response is always XML (from your backend or a minimal fallback).
  - All other routes go to **`/index.html`** for client-side routing.

- **`client/api/sitemap-proxy.js`**
  - Serverless function that fetches the requested sitemap from the backend and returns it with `Content-Type: application/xml`. On backend errors or timeouts it still returns a valid XML sitemap (200) so crawlers never get HTML.

---

## 7. Optional: custom domain

1. **Settings → Domains**.
2. Add your domain (e.g. `moviestream.cc` or `freemovie.online`).
3. Follow the DNS instructions (CNAME or A record to Vercel).
4. After DNS propagates, Vercel will issue SSL and serve the app on that domain.

---

## 8. Check sitemaps

After deploy, open:

- `https://<your-vercel-url>/sitemap_index.xml`
- `https://<your-vercel-url>/sitemaps.xml`

You should get XML with `Content-Type: application/xml`.  
If the backend is slow or down, you’ll still get a short XML sitemap instead of an HTML error page.
