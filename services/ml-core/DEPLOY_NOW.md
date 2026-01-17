# 🚀 Deploy Your ML Backend to DigitalOcean - RIGHT NOW!

## Current Status: ✅ READY TO DEPLOY

Your ML Core backend is fully prepared for deployment!

### What You Have:
✅ **Trained ML Model**: 381MB model file ready  
✅ **GitHub Repository**: `aram-ap/Veritas-Web`  
✅ **Docker Configuration**: Dockerfile updated and ready  
✅ **Environment Config**: `.env` file configured with Gemini API  
✅ **Deployment Scripts**: All automation scripts created  

---

## 🎯 Deploy in 3 Easy Steps

### Step 1: Commit Your Changes (2 minutes)

```bash
cd /Users/arama/Projects/CruzHacks26

# Add all the new deployment files
git add services/ml-core/

# Commit everything
git commit -m "Add DigitalOcean deployment configuration"

# Push to GitHub
git push origin main
```

### Step 2: Choose Your Deployment Method

#### Option A: Interactive Script (Easiest) 🎯

```bash
cd services/ml-core
./deploy-to-digitalocean.sh
```

This script will:
- ✅ Verify everything is ready
- ✅ Collect your configuration
- ✅ Generate the app spec file
- ✅ Test the Docker build
- ✅ Guide you through deployment

#### Option B: Web Console (Visual) 🖥️

1. **Go to DigitalOcean**: https://cloud.digitalocean.com/apps
2. **Click "Create App"**
3. **Connect GitHub**:
   - Select repository: `aram-ap/Veritas-Web`
   - Branch: `main`
   - Auto-deploy: ✅ Enable
4. **Configure Service**:
   - Source directory: `/services/ml-core`
   - Dockerfile path: `services/ml-core/Dockerfile`
   - Name: `ml-core-api`
5. **Set Environment Variables**:
   ```
   PORT=8000
   GEMINI_API_KEY=<your-key-from-.env-file>
   CORS_ORIGINS=http://localhost:3000,https://your-domain.com
   LOG_LEVEL=info
   WORKERS=1
   ```
6. **Configure Settings**:
   - HTTP Port: `8000`
   - Health Check: `/health`
   - Instance: **Professional XS** (1 GB RAM) - **$12/month**
7. **Click "Create Resources"**

#### Option C: CLI Deployment (Advanced) 💻

```bash
# Install doctl
brew install doctl

# Authenticate
doctl auth init

# Update app-spec.yaml with your details
nano services/ml-core/app-spec.yaml
# Change: repo, GEMINI_API_KEY, CORS_ORIGINS

# Deploy
cd services/ml-core
doctl apps create --spec app-spec.yaml

# Monitor
doctl apps list
doctl apps logs <app-id> --follow
```

### Step 3: Test Your Deployment (1 minute)

Once deployed (5-10 minutes), you'll get a URL like:
```
https://ml-core-api-xxxxx.ondigitalocean.app
```

Test it:

```bash
# Health check
curl https://your-url.ondigitalocean.app/health

# Should return:
# {"status":"healthy","message":"Service is running","model_loaded":true}
```

**Full API test:**

```bash
curl -X POST "https://your-url.ondigitalocean.app/predict" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Breaking news: Scientists have discovered a revolutionary new form of renewable energy that could solve the climate crisis. The technology, developed at a leading university, promises to deliver unlimited clean power at a fraction of current costs.",
    "title": "Revolutionary Energy Discovery Announced"
  }'
```

---

## 📊 Your Deployment Details

### Repository Info:
- **GitHub**: `https://github.com/aram-ap/Veritas-Web`
- **Branch**: `main`
- **Source Directory**: `/services/ml-core`

### Model Info:
- **File**: `models/misinfo_model.pkl`
- **Size**: 381 MB
- **Type**: TF-IDF + PassiveAggressiveClassifier
- **Accuracy**: ~93-95%

### Recommended Configuration:
- **Instance**: Professional XS (1 GB RAM, 1 vCPU)
- **Cost**: $12/month
- **Region**: NYC (or closest to your users)
- **Health Check**: `/health`
- **Port**: 8000

### Required Environment Variables:
```bash
PORT=8000
GEMINI_API_KEY=<from-your-.env-file>
CORS_ORIGINS=http://localhost:3000,https://your-frontend-domain.com
LOG_LEVEL=info
WORKERS=1
```

---

## 🔗 Connect to Your Frontend

After deployment, update your Next.js frontend:

**In `apps/web/.env`:**
```bash
# Add this line with your actual DigitalOcean URL
ML_API_URL=https://ml-core-api-xxxxx.ondigitalocean.app
```

**In `apps/web/src/app/api/analyze/route.ts`:**
```typescript
const ML_API_URL = process.env.ML_API_URL || "http://localhost:8000";
```

Then redeploy your frontend to Vercel!

---

## 📈 What Happens During Deployment

1. **Build Phase** (3-5 min):
   - DigitalOcean clones your GitHub repo
   - Builds Docker image with your 381MB model
   - Installs all Python dependencies
   - Creates optimized production image

2. **Deploy Phase** (1-2 min):
   - Spins up container on DigitalOcean infrastructure
   - Loads ML model into memory
   - Runs health checks
   - Assigns public URL with automatic HTTPS

3. **Ready** (Total: 5-10 min):
   - Your API is live and accessible
   - Auto-scaling enabled
   - SSL certificate active
   - Monitoring dashboard available

---

## 💡 Pro Tips

### 1. Monitor Your Deployment
- Go to: DigitalOcean Console → Apps → Your App
- Check "Runtime Logs" for any issues
- View "Metrics" for performance data

### 2. Set Up Custom Domain (Optional)
```bash
# In DigitalOcean App Platform
Settings → Domains → Add Domain
# Point your DNS records as instructed
```

### 3. Enable Auto-Deploy
Already configured! Every push to `main` branch automatically deploys.

### 4. Scale If Needed
- Start with Professional XS ($12/mo)
- Monitor CPU/Memory usage
- Upgrade if you see consistent >80% usage

### 5. Save Costs During Development
- Use Basic XS ($5/mo) for testing
- Upgrade to Professional XS for production
- Can pause/destroy app when not in use

---

## 🆘 Troubleshooting

### Build Fails: "Model not found"
**Solution**: Make sure you've committed and pushed the updated Dockerfile that includes the model copy.

### Build Timeout
**Solution**: Increase timeout in App Platform settings (Settings → Build → Timeout: 30 minutes)

### Out of Memory
**Solution**: Upgrade to Professional XS or higher (your model needs at least 1 GB RAM)

### Can't Connect After Deployment
**Solution**: 
1. Check build logs for errors
2. Verify health check passes: `curl https://your-url/health`
3. Check environment variables are set correctly

### CORS Errors from Frontend
**Solution**: Update `CORS_ORIGINS` environment variable with your frontend URL

---

## 📚 Documentation Reference

- **Quick Start**: [DEPLOYMENT_QUICKSTART.md](./DEPLOYMENT_QUICKSTART.md) - Simple step-by-step guide
- **Complete Guide**: [DIGITALOCEAN_DEPLOYMENT.md](./DIGITALOCEAN_DEPLOYMENT.md) - All deployment methods and advanced options
- **Pre-Deploy Check**: Run `./pre-deploy-check.sh` anytime to verify readiness
- **Deployment Script**: Run `./deploy-to-digitalocean.sh` for guided deployment

---

## ✅ Pre-Flight Checklist

Before clicking "Deploy", verify:

- [x] Model file exists (381MB) ✅
- [x] Code is in GitHub ✅
- [x] Dockerfile updated ✅
- [ ] Changes committed and pushed (DO THIS NOW!)
- [ ] DigitalOcean account created
- [ ] Gemini API key ready (check your .env file)
- [ ] CORS origins configured for your frontend URLs

---

## 🎯 START HERE

Ready? Run this command now:

```bash
# Commit your changes
cd /Users/arama/Projects/CruzHacks26
git add services/ml-core/
git commit -m "Add DigitalOcean deployment configuration"
git push origin main

# Then run the deployment script
cd services/ml-core
./deploy-to-digitalocean.sh
```

**OR** go directly to:
👉 **https://cloud.digitalocean.com/apps/new**

---

## 🎉 After Successful Deployment

1. ✅ Test your API endpoints
2. ✅ Update frontend environment variables
3. ✅ Redeploy frontend to Vercel
4. ✅ Test the full integration
5. ✅ Set up monitoring alerts (optional)
6. ✅ Add custom domain (optional)
7. ✅ Celebrate! 🎊

---

**Your backend is ready to go live. Let's do this! 🚀**
