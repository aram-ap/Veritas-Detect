# 🔗 Connect All Your Services

## Your Deployed Services

| Service | URL | Status |
|---------|-----|--------|
| **ML Backend** | `https://veritas-ml-core-api-simr6.ondigitalocean.app` | ✅ Deployed |
| **Frontend** | Your Vercel URL | 🔄 Needs update |
| **Extension** | Chrome Extension | 🔄 Needs update |

---

## 🎯 Quick Setup (10 minutes)

### Step 1: Update Frontend Environment Variables (Vercel)

Your Next.js frontend needs to know where the ML backend is.

**Go to Vercel:**
1. Open: https://vercel.com/dashboard
2. Click your project
3. Go to **Settings** → **Environment Variables**
4. Add/Update this variable:

```
Key:   PYTHON_BACKEND_URL
Value: https://veritas-ml-core-api-simr6.ondigitalocean.app
Scope: Production, Preview, Development (select all)
```

5. Click **"Save"**
6. Go to **Deployments** tab
7. Click **"Redeploy"** on your latest deployment

**Expected time:** 2-3 minutes for redeploy

---

### Step 2: Update Chrome Extension

Your extension needs to point to your production Vercel URL.

**Update extension config:**

```bash
cd /Users/arama/Projects/CruzHacks26/apps/extension

# Edit .env.production
nano .env.production

# Change this line to your actual Vercel URL:
VITE_API_URL=https://your-app-name.vercel.app

# Rebuild
npm run build

# Reload extension in Chrome:
# 1. Go to chrome://extensions/
# 2. Find "Veritas" extension
# 3. Click reload button 🔄
```

**Expected time:** 2 minutes

---

### Step 3: Test the Complete Flow

**Test 1: ML Backend Health**
```bash
curl https://veritas-ml-core-api-simr6.ondigitalocean.app/health
```

Expected:
```json
{
  "status": "healthy",
  "message": "Service is running",
  "model_loaded": true
}
```

**Test 2: Frontend → Backend Connection**
1. Go to your Vercel URL
2. Sign in
3. Go to Dashboard
4. Try analyzing an article
5. Should work! ✅

**Test 3: Extension → Frontend → Backend**
1. Click Chrome extension icon
2. Sign in
3. Navigate to a news article
4. Click "Scan for Misinformation"
5. Should work! ✅

---

## 📊 Architecture Overview

```
┌─────────────────┐
│ Chrome Extension│
│   (User clicks) │
└────────┬────────┘
         │ HTTPS
         ↓
┌─────────────────┐
│  Vercel Frontend│
│   (Next.js API) │
└────────┬────────┘
         │ HTTPS
         ↓
┌─────────────────┐
│ DigitalOcean ML │
│  (FastAPI + AI) │
└─────────────────┘
```

**Data Flow:**
1. User clicks "Analyze" in extension
2. Extension calls Vercel API at `/api/analyze`
3. Vercel calls ML backend at `/predict`
4. ML backend analyzes with AI model
5. Results flow back: ML → Vercel → Extension → User

---

## 🔧 Environment Variables Summary

### Frontend (Vercel) - Required:
```bash
# Auth0
AUTH0_SECRET=<generated-with-openssl>
AUTH0_BASE_URL=https://your-app.vercel.app
AUTH0_ISSUER_BASE_URL=https://your-domain.auth0.com
AUTH0_CLIENT_ID=<your-auth0-client-id>
AUTH0_CLIENT_SECRET=<your-auth0-secret>

# Database
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require

# ML Backend ← ADD THIS!
PYTHON_BACKEND_URL=https://veritas-ml-core-api-simr6.ondigitalocean.app

# Gemini (optional, for extra features)
GEMINI_API_KEY=<your-gemini-key>
```

### ML Backend (DigitalOcean) - Required:
```bash
# Port (already set)
PORT=8000

# Gemini for explanations
GEMINI_API_KEY=<your-gemini-key>

# CORS (already configured in code)
CORS_ORIGINS=https://your-app.vercel.app
```

### Extension - Required:
```bash
# In apps/extension/.env.production
VITE_API_URL=https://your-app.vercel.app
```

---

## ✅ Verification Checklist

### ML Backend:
- [ ] Deployed to DigitalOcean
- [ ] Health check returns `model_loaded: true`
- [ ] Can access `/docs` (Swagger UI)
- [ ] URL: `https://veritas-ml-core-api-simr6.ondigitalocean.app`

### Frontend:
- [ ] Deployed to Vercel
- [ ] `PYTHON_BACKEND_URL` environment variable set
- [ ] Can sign in with Auth0
- [ ] Dashboard loads
- [ ] Can analyze text (calls ML backend)

### Extension:
- [ ] Built with production config
- [ ] `VITE_API_URL` points to Vercel
- [ ] Loaded in Chrome
- [ ] Can sign in
- [ ] Can analyze articles

---

## 🆘 Troubleshooting

### Frontend can't reach ML backend

**Error:** "Analysis service unavailable" (502)

**Check:**
```bash
# 1. Verify ML backend is up
curl https://veritas-ml-core-api-simr6.ondigitalocean.app/health

# 2. Check Vercel environment variable
# Go to Vercel → Settings → Environment Variables
# PYTHON_BACKEND_URL should be set

# 3. Check Vercel logs
# Vercel Dashboard → Your Project → Deployments → Logs
# Look for: "[Next.js] Calling Python backend at..."
```

**Fix:**
1. Add `PYTHON_BACKEND_URL` to Vercel
2. Redeploy Vercel app
3. Test again

---

### Extension shows "Session expired"

**Error:** Extension can't authenticate

**Check:**
```bash
# 1. Check extension config
cat apps/extension/.env.production
# Should have: VITE_API_URL=https://your-app.vercel.app

# 2. Check CORS in ML backend
# Should allow: chrome-extension://*
```

**Fix:**
1. Update extension `.env.production`
2. Rebuild: `npm run build`
3. Reload extension in Chrome

---

### ML backend returns "Model not loaded"

**Error:** `model_loaded: false` in health check

**This means:** Git LFS didn't work, need to use Spaces

**Fix:** Follow `DIGITALOCEAN_LFS_FALLBACK.md`

---

## 🎯 Quick Commands Reference

```bash
# Test ML backend
curl https://veritas-ml-core-api-simr6.ondigitalocean.app/health

# Test ML backend prediction
curl -X POST https://veritas-ml-core-api-simr6.ondigitalocean.app/predict \
  -H "Content-Type: application/json" \
  -d '{"text":"Your test article text here...", "title":"Test"}'

# Rebuild extension
cd apps/extension && npm run build

# View Vercel logs
vercel logs --follow

# Check DigitalOcean logs
# Go to: https://cloud.digitalocean.com/apps → Your App → Runtime Logs
```

---

## 📝 URLs to Remember

| What | URL |
|------|-----|
| **ML Backend** | https://veritas-ml-core-api-simr6.ondigitalocean.app |
| **ML API Docs** | https://veritas-ml-core-api-simr6.ondigitalocean.app/docs |
| **ML Health Check** | https://veritas-ml-core-api-simr6.ondigitalocean.app/health |
| **Vercel Dashboard** | https://vercel.com/dashboard |
| **DO Dashboard** | https://cloud.digitalocean.com/apps |
| **Chrome Extensions** | chrome://extensions/ |

---

## 🎉 Success Criteria

Your system is fully connected when:

1. ✅ ML backend health check shows `model_loaded: true`
2. ✅ Can sign in on Vercel frontend
3. ✅ Can analyze text on Vercel frontend
4. ✅ Extension can sign in
5. ✅ Extension can analyze articles
6. ✅ Results show up with trust score and flagged content

---

## 🚀 Next Steps After Connection

1. **Test thoroughly** - Try analyzing different articles
2. **Monitor logs** - Check for errors in Vercel and DigitalOcean
3. **Update documentation** - Add your actual URLs to docs
4. **Add custom domain** (optional) - Use your own domain instead of `.vercel.app`
5. **Publish extension** (optional) - Submit to Chrome Web Store

---

## 💡 Pro Tips

1. **Bookmark these URLs:**
   - Your ML backend health check
   - Vercel dashboard
   - DigitalOcean dashboard

2. **Set up monitoring:**
   - Use UptimeRobot to monitor ML backend
   - Enable Vercel analytics
   - Check logs regularly

3. **Keep credentials safe:**
   - Never commit `.env` files
   - Rotate API keys every 90 days
   - Use environment variables for all secrets

---

**Ready to connect everything?** Start with Step 1 (Vercel environment variables)! 🎯
