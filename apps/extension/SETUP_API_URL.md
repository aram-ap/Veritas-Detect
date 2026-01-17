# 🔧 Quick Fix: Update Extension API URL

## Problem
Your Chrome extension is hardcoded to `localhost:3000` and needs to connect to your deployed backend.

## ✅ Solution Applied

I've added environment configuration to your extension!

### Files Created:
1. **`src/config.ts`** - Centralized configuration
2. **`.env.development`** - Development settings (localhost)
3. **`.env.production`** - Production settings (your deployed URL)
4. **`.env.example`** - Template file

### Files Updated:
- **`src/App.tsx`** - Now uses config instead of hardcoded URLs

---

## 🚀 Quick Setup

### Step 1: Update Production URL

Edit `.env.production`:
```bash
cd apps/extension
nano .env.production
```

Change this line:
```bash
VITE_API_URL=https://your-app.vercel.app
```

To your actual Vercel URL:
```bash
VITE_API_URL=https://your-actual-app.vercel.app
```

### Step 2: Rebuild Extension

```bash
cd apps/extension
npm run build
```

### Step 3: Reload Extension

1. Go to `chrome://extensions/`
2. Find "Veritas" extension
3. Click the refresh/reload button
4. Done! Extension now connects to production!

---

## 🎯 Usage Examples

### For Local Development
```bash
# Uses .env.development (localhost:3000)
cd apps/extension
npm run dev
```

### For Production
```bash
# Uses .env.production (your Vercel URL)
cd apps/extension
npm run build
```

### Switch Environments Manually

**In `src/config.ts`**, you can temporarily override:
```typescript
// Force production URL for testing
export const API_BASE_URL = 'https://your-app.vercel.app';
```

---

## 🔍 Verify It's Working

### Check Console Logs
1. Open extension (click icon)
2. Right-click → "Inspect"
3. Check Console for:
   ```
   [Veritas Config] {
     environment: 'production',
     apiBaseUrl: 'https://your-app.vercel.app',
     ...
   }
   ```

### Test Authentication
1. Click "Sign In"
2. Should redirect to your production URL (not localhost!)
3. After signing in, extension should work

---

## 📋 Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `VITE_API_URL` | Backend API URL | `https://your-app.vercel.app` |

**Note**: All extension environment variables must start with `VITE_` to be accessible.

---

## 🆘 Troubleshooting

### Extension still uses localhost

**Solution**:
```bash
# 1. Check .env.production has correct URL
cat .env.production

# 2. Rebuild
npm run build

# 3. Hard reload extension
# Remove and re-add from chrome://extensions/
```

### CORS errors

**Solution**: Make sure your Vercel backend allows extension requests.

In `apps/web/src/middleware.ts`:
```typescript
// Add to CORS origins
const allowedOrigins = [
  'chrome-extension://*',
  process.env.NEXT_PUBLIC_APP_URL,
];
```

### Can't find deployed URL

Check your Vercel deployment:
```bash
# Your Vercel URL looks like:
# https://your-app-name.vercel.app
# or
# https://your-custom-domain.com
```

---

## 📦 Build Outputs

After running `npm run build`:

```
apps/extension/dist/
├── manifest.json    # Extension manifest
├── index.html       # Extension UI
├── assets/          # Bundled JS/CSS
└── icons/           # Extension icons
```

This `dist` folder is what you load in Chrome or publish to Chrome Web Store.

---

## 🎓 How It Works

### Before (Hardcoded):
```typescript
fetch('http://localhost:3000/api/analyze', { ... })  // ❌ Always localhost
```

### After (Environment-aware):
```typescript
import { API_ENDPOINTS } from './config';
fetch(API_ENDPOINTS.ANALYZE, { ... })  // ✅ Uses env variable
```

### Config loads based on build:
- **Dev build**: Uses `.env.development` → `localhost:3000`
- **Prod build**: Uses `.env.production` → Your Vercel URL

---

## ✅ Checklist

- [ ] Created `.env.production` with your Vercel URL
- [ ] Rebuilt extension: `npm run build`
- [ ] Reloaded extension in Chrome
- [ ] Tested sign-in (redirects to production, not localhost)
- [ ] Tested article analysis (calls production API)
- [ ] Extension works with deployed backend!

---

## 🎯 Next Steps

1. **Update `.env.production`** with your real Vercel URL
2. **Rebuild**: `npm run build`
3. **Test**: Load extension and verify it connects to production
4. **Deploy**: Everything should work now!

**Need your Vercel URL?**
- Check Vercel dashboard: https://vercel.com/dashboard
- Or check your last Vercel deployment logs

---

Your extension is now configurable! 🎉
