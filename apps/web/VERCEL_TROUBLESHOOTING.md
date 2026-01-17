# Vercel 500 Error Troubleshooting

## Common Causes & Fixes

### 1. Check Vercel Environment Variables

Go to your Vercel project → Settings → Environment Variables

**Required Variables:**
```bash
AUTH0_SECRET=your_secret_here
AUTH0_BASE_URL=https://your-app.vercel.app  ← MUST match your Vercel domain!
AUTH0_ISSUER_BASE_URL=https://YOUR_DOMAIN.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
DATABASE_URL=postgresql://...
PYTHON_BACKEND_URL=your_backend_url
GEMINI_API_KEY=your_api_key
NODE_ENV=production
```

**Most Common Issue**: `AUTH0_BASE_URL` doesn't match your actual Vercel URL

### 2. Update Auth0 Allowed URLs

Go to https://manage.auth0.com/

1. Applications → Your Application → Settings
2. Update these fields:

**Allowed Callback URLs:**
```
https://your-app.vercel.app/api/auth/callback
```

**Allowed Logout URLs:**
```
https://your-app.vercel.app
```

**Allowed Web Origins:**
```
https://your-app.vercel.app
```

### 3. Check Vercel Logs

To see the actual error:

1. Go to your Vercel project
2. Click on the deployment
3. Click "Functions" tab
4. Find the failing API route
5. Read the error message

### 4. Redeploy After Fixing

After updating environment variables:
1. Go to Deployments tab
2. Click "..." on latest deployment
3. Click "Redeploy"

Or just push a new commit to trigger redeployment.

## Step-by-Step Fix

### Quick Fix Checklist:

```bash
□ AUTH0_BASE_URL matches your Vercel URL exactly
□ All Auth0 environment variables are set in Vercel
□ DATABASE_URL is set in Vercel
□ Auth0 callback URL includes your Vercel domain
□ Redeployed after adding environment variables
```

### If Still Not Working:

Check Vercel function logs for specific error message and share it.
