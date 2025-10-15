<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/temp/1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to Vercel (to enable /api/parse CORS proxy)

If you deploy this folder to Vercel, the included serverless function at `api/parse.js` will provide a same-origin endpoint that proxies to the deployed parse endpoint and responds with CORS headers so web clients won't be blocked by preflight.

Quick steps:
- Install the Vercel CLI and login: `npm i -g vercel && vercel login`
- From this folder run `vercel` and follow prompts to deploy.

After deploy, call `https://<your-deployment-domain>/api/parse` from web apps to avoid CORS issues.

If you want the legacy route `/parse` to work the same way, this repo includes a `vercel.json` rewrite so `/parse` will be served by the serverless function at `/api/parse` (and thus include the CORS headers). Redeploy after adding any files.

Authentication / credentials
----------------------------
The serverless function needs credentials to call the Gemini API. You can provide credentials in one of two ways (set these as environment variables in Vercel):

- API key (recommended for simplicity):
   - `API_KEY` or `GEMINI_API_KEY` or `GOOGLE_API_KEY` = your Gemini API key

- Service account (if using application default credentials):
   - `SERVICE_ACCOUNT_JSON_BASE64` = base64 encoded service account JSON (the function will write this to /tmp and set GOOGLE_APPLICATION_CREDENTIALS)

Set the env vars in your Vercel project settings before deploying so the function can call the Gemini API.
