# ML Core - DigitalOcean Deployment Quick Start

This guide gets you deployed to DigitalOcean in the fastest way possible.

## Prerequisites

- ✅ Trained ML model (`models/misinfo_model.pkl`) - **YOU HAVE THIS!**
- ✅ GitHub repository with your code
- ✅ DigitalOcean account ([Sign up here](https://www.digitalocean.com/))
- ✅ Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))

## 🚀 Quick Deploy (5 minutes)

### Method 1: Automated Script (Recommended)

Run the automated deployment script:

```bash
cd services/ml-core
./deploy-to-digitalocean.sh
```

This script will:
1. ✅ Check all prerequisites
2. ✅ Collect deployment configuration
3. ✅ Generate `app-spec.yaml`
4. ✅ Test Docker build
5. ✅ Commit and push changes
6. ✅ Provide deployment instructions

Then follow the on-screen instructions to complete deployment!

### Method 2: Manual Deployment (via Web Console)

**Step 1: Prepare your files**

Make sure your code is pushed to GitHub:

```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

**Step 2: Update app-spec.yaml**

Edit `app-spec.yaml` and update:
- `repo:` with your GitHub username and repo name
- `GEMINI_API_KEY:` with your actual API key
- `CORS_ORIGINS:` with your frontend URLs

**Step 3: Deploy to DigitalOcean**

1. Go to https://cloud.digitalocean.com/apps
2. Click **"Create App"**
3. Select **GitHub** as source
4. Choose your repository: `your-username/CruzHacks26`
5. Select branch: `main`
6. Set source directory: `/services/ml-core`
7. Configure:
   - Name: `ml-core-backend`
   - Port: `8000`
   - Health check: `/health`
8. Add environment variables:
   ```
   GEMINI_API_KEY=your_actual_key_here
   CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
   PORT=8000
   ```
9. Choose plan: **Professional XS** ($12/month recommended)
10. Click **"Create Resources"**

**Step 4: Wait for Deployment**

First deployment takes 5-10 minutes. Watch the build logs for progress.

**Step 5: Test Your API**

You'll get a URL like: `https://ml-core-backend-xxxxx.ondigitalocean.app`

Test it:

```bash
# Health check
curl https://your-app-url.ondigitalocean.app/health

# Test prediction
curl -X POST "https://your-app-url.ondigitalocean.app/predict" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Scientists discover new renewable energy breakthrough that could change the world.",
    "title": "Clean Energy Discovery"
  }'
```

## 📊 What Gets Deployed

Your deployment includes:
- ✅ FastAPI backend (port 8000)
- ✅ Trained ML model (381MB) baked into the image
- ✅ All Python dependencies
- ✅ Health monitoring
- ✅ Auto-scaling support
- ✅ HTTPS enabled automatically
- ✅ Automatic deployments on git push

## 💰 Estimated Costs

| Plan | RAM | CPU | Price/Month | Recommended For |
|------|-----|-----|-------------|-----------------|
| Basic XS | 512 MB | 1 vCPU | $5 | Development |
| **Professional XS** | **1 GB** | **1 vCPU** | **$12** | **Production** ⭐ |
| Professional S | 2 GB | 2 vCPU | $24 | High traffic |

**Recommended**: Start with Professional XS ($12/month)

## 🔧 Common Issues & Fixes

### Issue: "Model not found"

**Cause**: Model file wasn't included in Docker build

**Fix**:
```bash
# Verify model exists locally
ls -lh models/misinfo_model.pkl

# Rebuild and redeploy
git add Dockerfile
git commit -m "Include model in Docker image"
git push
```

### Issue: "Out of memory"

**Cause**: Instance is too small (your model is 381MB)

**Fix**: Upgrade to Professional XS (1 GB RAM) or higher in App Platform settings

### Issue: "Build timeout"

**Cause**: Large model file (381MB) takes time to upload

**Fix**: 
- Increase build timeout in App Platform settings (go to Settings → Build)
- Or use external storage for the model (see advanced section)

### Issue: "CORS error"

**Cause**: Frontend URL not in CORS_ORIGINS

**Fix**: Update environment variable in App Platform:
```
CORS_ORIGINS=https://your-frontend.vercel.app,http://localhost:3000
```

## 🔄 Updating Your Deployment

After the initial deployment, updates are automatic:

```bash
# Make your changes
git add .
git commit -m "Update model or code"
git push

# DigitalOcean automatically rebuilds and redeploys!
```

## 📱 Connecting Your Frontend

Update your frontend environment variables:

**Vercel:**
```bash
# In your Vercel dashboard
ML_API_URL=https://your-app.ondigitalocean.app
```

**Local .env:**
```bash
# In apps/web/.env
NEXT_PUBLIC_ML_API_URL=https://your-app.ondigitalocean.app
```

**Next.js API route:**
```typescript
// apps/web/src/app/api/analyze/route.ts
const ML_API_URL = process.env.ML_API_URL || "https://your-app.ondigitalocean.app";
```

## 📚 Additional Resources

- **Full Deployment Guide**: See [DIGITALOCEAN_DEPLOYMENT.md](./DIGITALOCEAN_DEPLOYMENT.md) for advanced options
- **App Platform Docs**: https://docs.digitalocean.com/products/app-platform/
- **doctl CLI**: https://docs.digitalocean.com/reference/doctl/

## 🆘 Need Help?

1. **Check build logs** in DigitalOcean App Platform console
2. **Check runtime logs**: Apps → Your App → Runtime Logs
3. **Run pre-deployment checks**: `./pre-deploy-check.sh`
4. **Review the full guide**: [DIGITALOCEAN_DEPLOYMENT.md](./DIGITALOCEAN_DEPLOYMENT.md)

## ✅ Checklist

Before deploying, make sure:

- [ ] Trained model exists: `models/misinfo_model.pkl` ✅ (You have this!)
- [ ] Code is pushed to GitHub
- [ ] DigitalOcean account created
- [ ] Gemini API key ready
- [ ] `app-spec.yaml` updated with your repo details
- [ ] Dockerfile includes model copy (already done!)
- [ ] CORS origins configured for your frontend

## 🎯 Next Steps After Deployment

1. ✅ Test all API endpoints
2. ✅ Update frontend to use production API URL
3. ✅ Set up custom domain (optional)
4. ✅ Configure monitoring/alerts
5. ✅ Set up automatic backups
6. ✅ Review and optimize costs

---

**Ready to deploy?** Run `./deploy-to-digitalocean.sh` now! 🚀
