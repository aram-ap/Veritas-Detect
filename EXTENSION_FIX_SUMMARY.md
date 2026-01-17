# ✅ Extension Localhost Fix - Complete

## Problem Solved
Your Chrome extension was hardcoded to use `localhost:3000` and couldn't connect to your deployed backend.

## ✅ Changes Made

### New Files Created:

1. **`apps/extension/src/config.ts`**
   - Centralized configuration system
   - Automatically detects development vs production
   - Manages all API endpoints

2. **`apps/extension/.env.development`**
   - Development environment (localhost:3000)
   - Used during local development

3. **`apps/extension/.env.production`**
   - Production environment
   - **YOU NEED TO UPDATE THIS** with your Vercel URL

4. **`apps/extension/.env.example`**
   - Template for environment variables
   - Safe to commit to git

5. **`apps/extension/SETUP_API_URL.md`**
   - Quick setup guide for configuration

6. **`apps/extension/EXTENSION_DEPLOYMENT.md`**
   - Complete deployment guide

### Files Modified:

1. **`apps/extension/src/App.tsx`**
   - Replaced all hardcoded `localhost:3000` URLs
   - Now imports and uses `config.ts`
   - 6 API calls updated:
     - Authentication check
     - Login redirect
     - Logout redirect  
     - Analyze endpoint
     - Cookie configuration (2 places)

---

## 🚀 What You Need to Do NOW

### Step 1: Update Production URL (2 minutes)

```bash
cd apps/extension

# Edit .env.production
nano .env.production

# Change this line:
VITE_API_URL=https://your-app.vercel.app

# To your actual Vercel URL:
VITE_API_URL=https://your-actual-vercel-url.vercel.app
```

### Step 2: Rebuild Extension (1 minute)

```bash
cd apps/extension
npm run build
```

### Step 3: Reload Extension in Chrome (30 seconds)

1. Go to `chrome://extensions/`
2. Find "Veritas" extension
3. Click the refresh/reload icon 🔄
4. Done!

### Step 4: Test It Works

1. Click extension icon
2. Try to sign in - should redirect to your production URL (not localhost!)
3. Analyze an article - should call your production API

---

## 📊 Before vs After

### Before (Hardcoded):
```typescript
// App.tsx - Line 35
fetch('http://localhost:3000/api/auth/extension-token', ...)

// App.tsx - Line 218
chrome.tabs.create({ url: 'http://localhost:3000/api/auth/login' });

// App.tsx - Line 286
fetch('http://localhost:3000/api/analyze', ...)
```

### After (Environment-aware):
```typescript
// App.tsx - Now uses config
import { API_ENDPOINTS, COOKIE_CONFIG } from './config';

fetch(API_ENDPOINTS.AUTH_EXTENSION_TOKEN, ...)
chrome.tabs.create({ url: API_ENDPOINTS.AUTH_LOGIN });
fetch(API_ENDPOINTS.ANALYZE, ...)
```

### Config (Automatic):
```typescript
// config.ts
const isDevelopment = import.meta.env.DEV;
const PRODUCTION_URL = import.meta.env.VITE_API_URL;

export const API_BASE_URL = isDevelopment 
  ? 'http://localhost:3000'  // Dev
  : PRODUCTION_URL;            // Prod
```

---

## 🎯 How It Works

### Development Build:
```bash
npm run dev
# Uses .env.development
# Extension connects to: http://localhost:3000
```

### Production Build:
```bash
npm run build
# Uses .env.production  
# Extension connects to: https://your-app.vercel.app
```

### Environment Detection:
- **Automatically** detects if running in dev or prod
- **No manual switching** needed
- **Console logs** show which environment is active

---

## 🔍 Verify Configuration

After rebuilding, check the console:

1. Open extension
2. Right-click → "Inspect"
3. Check Console:

```javascript
[Veritas Config] {
  environment: 'production',
  apiBaseUrl: 'https://your-app.vercel.app',
  isDevelopment: false
}
```

---

## 📚 Documentation Created

| File | Purpose |
|------|---------|
| `SETUP_API_URL.md` | Quick setup guide |
| `EXTENSION_DEPLOYMENT.md` | Complete deployment guide |
| `EXTENSION_FIX_SUMMARY.md` | This file - what was changed |

---

## ✅ Checklist

### Immediate Actions:
- [ ] Update `.env.production` with your Vercel URL
- [ ] Rebuild extension: `npm run build`
- [ ] Reload extension in Chrome
- [ ] Test sign-in (should use production URL)
- [ ] Test article analysis (should call production API)

### Verification:
- [ ] Console shows correct API URL
- [ ] Sign-in redirects to production (not localhost)
- [ ] Extension successfully analyzes articles
- [ ] No CORS errors

### Optional:
- [ ] Commit changes to git
- [ ] Deploy extension to Chrome Web Store
- [ ] Update documentation with your URL

---

## 🆘 Quick Troubleshooting

### Extension still uses localhost
```bash
# 1. Check .env.production
cat apps/extension/.env.production

# 2. Rebuild
cd apps/extension && npm run build

# 3. Hard reload in Chrome
# Remove and re-add extension
```

### CORS errors
Add to your backend (Vercel):
```typescript
// apps/web/src/middleware.ts
headers.set('Access-Control-Allow-Origin', 'chrome-extension://*');
```

### Can't find Vercel URL
Check: https://vercel.com/dashboard
Look for your app deployment URL

---

## 📁 Project Structure

```
apps/extension/
├── src/
│   ├── config.ts              ← New: Configuration
│   └── App.tsx                ← Updated: Uses config
├── .env.example               ← New: Template
├── .env.development           ← New: Dev config
├── .env.production            ← New: Prod config (UPDATE THIS!)
├── SETUP_API_URL.md           ← New: Quick guide
├── EXTENSION_DEPLOYMENT.md    ← New: Full guide
└── package.json
```

---

## 🎓 What Changed Technically

### 1. Created Config System
- `config.ts` exports API endpoints
- Reads from environment variables
- Automatically detects dev vs prod

### 2. Updated All API Calls
- Replaced 6 hardcoded URLs
- Now uses imported constants
- Environment-aware

### 3. Added Environment Files
- `.env.development` - localhost
- `.env.production` - your URL
- Vite automatically loads correct file

### 4. Made It Maintainable
- Single source of truth (config.ts)
- Easy to update URLs
- No more hardcoded values

---

## 🎉 You're Done!

Just update `.env.production` with your Vercel URL, rebuild, and reload the extension!

**Your extension will now work with your deployed backend!** 🚀

---

## Next Steps After This Fix

1. ✅ **Update production URL** (see Step 1 above)
2. ✅ **Test extension** with production backend
3. ✅ **Commit changes** to git
4. Optional: **Publish to Chrome Web Store**

---

Need help? Check:
- `SETUP_API_URL.md` - Quick setup
- `EXTENSION_DEPLOYMENT.md` - Full deployment guide
