AFA Fantasy — Cloudflare Pages deployment

This folder is a complete Cloudflare Pages project. index.html includes the saved league data; the Pages Function at /api/league retrieves the live JSON from Dynasty Tracker.

IMPORTANT: Cloudflare Pages dashboard drag-and-drop ZIP uploads do not reliably deploy Functions. Use a Git repository connected to Cloudflare Pages, or deploy with Wrangler.

Option A: GitHub
1. Create a GitHub repository and add the contents of THIS folder at the repository root (not the folder itself).
2. In Cloudflare Dashboard > Workers & Pages > Create application > Pages > Connect to Git.
3. Choose the repository. For static HTML, set framework preset None, build command blank, build output directory / (or . if required).
4. Deploy. Visit your *.pages.dev website. The badge should say LIVE if the upstream API is accessible.

Option B: Wrangler CLI
1. Install Node.js. In a terminal, run `npm install -g wrangler`.
2. From this folder, run `wrangler pages deploy . --project-name afa-fantasy` (log in if prompted).
3. Verify /api/league returns JSON (not a 404) on your deployed site.

Note: Cloudflare's own deploy support for Functions can vary depending on the deployment method. Git deployment is preferred. The public Dynasty Tracker API has not been independently reachable from this build environment, so live operation must be tested on the deployed URL.
