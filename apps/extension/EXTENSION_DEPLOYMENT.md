# Chrome Extension Deployment Guide

## Configure API URLs

The extension is now environment-aware and can connect to different backends.

### For Development (Local Testing)

1. **Create `.env.development` file** (already created):
   ```bash
   VITE_API_URL=http://localhost:3000
   ```

2. **Build the extension**:
   ```bash
   cd apps/extension
   npm run build
   ```

3. **Load in Chrome**:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `apps/extension/dist` folder

### For Production (Your Deployed App)

1. **Update `.env.production`** with your Vercel URL:
   ```bash
   VITE_API_URL=https://your-app.vercel.app
   ```

2. **Build for production**:
   ```bash
   cd apps/extension
   npm run build
   ```

3. **Test the production build**:
   - Load the extension from `dist` folder
   - Extension will now connect to your production API!

4. **Publish to Chrome Web Store** (optional):
   - Go to [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
   - Create a new item
   - Upload `dist` folder as ZIP
   - Fill in store listing details
   - Submit for review

---

## Environment Configuration

### Config File: `src/config.ts`

The extension uses `src/config.ts` to manage URLs:

```typescript
// Automatically detects environment
const isDevelopment = import.meta.env.DEV;

// Uses .env.development or .env.production
const PRODUCTION_URL = import.meta.env.VITE_API_URL || 'https://your-app.vercel.app';

export const API_BASE_URL = isDevelopment ? DEVELOPMENT_URL : PRODUCTION_URL;
```

### Environment Variables

The extension uses Vite's environment variable system:

- `VITE_API_URL` - Your backend API URL
- Prefix with `VITE_` to expose to the client

### Build Commands

```bash
# Development build (uses .env.development)
npm run build

# Production build (uses .env.production)
npm run build

# Development with watch
npm run dev
```

---

## Testing Different Environments

### Test Local Backend
```bash
# 1. Update .env.development
echo "VITE_API_URL=http://localhost:3000" > .env.development

# 2. Build
npm run build

# 3. Load extension in Chrome
# Extension connects to localhost:3000
```

### Test Production Backend
```bash
# 1. Update .env.production
echo "VITE_API_URL=https://your-app.vercel.app" > .env.production

# 2. Build
npm run build

# 3. Reload extension in Chrome
# Extension connects to production API
```

### Test Staging Backend
```bash
# 1. Create .env.staging
echo "VITE_API_URL=https://staging.your-app.vercel.app" > .env.staging

# 2. Build with staging env
NODE_ENV=staging npm run build

# 3. Load extension
# Extension connects to staging API
```

---

## CORS Configuration

Make sure your backend allows the extension:

**In `apps/web/src/middleware.ts`** or CORS config:
```typescript
// Allow extension requests
const allowedOrigins = [
  'http://localhost:3000',
  'chrome-extension://*', // Allow all Chrome extensions
];
```

**For production**, the extension runs with a unique `chrome-extension://` origin.

---

## Update Manifest for Production

If you need different permissions for production:

**File: `public/manifest.json`**

```json
{
  "host_permissions": [
    "http://localhost:3000/*",
    "https://your-app.vercel.app/*"
  ]
}
```

---

## Checklist for Production Deployment

### Backend (Vercel)
- [ ] Deploy Next.js app to Vercel
- [ ] Set up environment variables in Vercel
- [ ] Test `/api/analyze` endpoint works
- [ ] Configure CORS for chrome-extension://

### Extension
- [ ] Update `.env.production` with Vercel URL
- [ ] Test login flow with production backend
- [ ] Test article analysis with production backend
- [ ] Build production version: `npm run build`
- [ ] Test extension with production build
- [ ] Create screenshots for Chrome Web Store
- [ ] Write store listing description

### Chrome Web Store (Optional)
- [ ] Create developer account ($5 one-time fee)
- [ ] Upload extension ZIP
- [ ] Add store listing assets (screenshots, descriptions)
- [ ] Submit for review (typically 1-3 days)

---

## Troubleshooting

### Extension connects to localhost in production

**Problem**: Built extension still uses `localhost:3000`

**Solution**:
1. Check `.env.production` has correct URL
2. Rebuild: `npm run build`
3. Hard refresh extension in Chrome (remove and re-add)

### CORS errors

**Problem**: `No 'Access-Control-Allow-Origin' header`

**Solution**: Add to your Next.js middleware:
```typescript
headers.set('Access-Control-Allow-Origin', request.headers.get('origin') || '*');
headers.set('Access-Control-Allow-Credentials', 'true');
```

### Auth not working

**Problem**: Login redirects but extension doesn't detect auth

**Solution**:
1. Check cookies are set with correct domain
2. Verify extension has `cookies` permission in manifest
3. Check `host_permissions` includes your backend domain

### Extension shows wrong environment

**Problem**: Console shows wrong API URL

**Solution**:
1. Check `src/config.ts` is using correct env variable
2. Rebuild extension
3. Check Chrome DevTools console for config log

---

## Development Workflow

### Daily Development
```bash
# 1. Start Next.js backend
cd apps/web
npm run dev  # Runs on localhost:3000

# 2. Build extension (watch mode)
cd apps/extension
npm run dev

# 3. Reload extension in Chrome when changes detected
```

### Testing Production Build Locally
```bash
# 1. Update .env.production with production URL
# 2. Build extension
npm run build

# 3. Load built extension from dist/
# 4. Test against production backend
```

---

## Environment Files Summary

```
apps/extension/
├── .env.example         # Template (committed to git)
├── .env.development     # Local dev (gitignored)
├── .env.production      # Production (gitignored)
└── src/config.ts        # Config loader (committed to git)
```

---

## Quick Reference

| Environment | File | API URL |
|-------------|------|---------|
| Development | `.env.development` | `http://localhost:3000` |
| Production | `.env.production` | Your Vercel URL |
| Custom | `.env.{name}` | Any URL |

---

## Next Steps

1. **Update `.env.production`** with your actual Vercel URL
2. **Build production version**: `npm run build`
3. **Test locally** before publishing
4. **Publish to Chrome Web Store** (optional)

Your extension is now environment-aware! 🎉
