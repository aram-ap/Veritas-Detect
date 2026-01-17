# DigitalOcean Git LFS Fallback Plan

## If Git LFS Doesn't Work with DO App Platform

If your deployment still shows "Model not found" after the rebuild, it means DigitalOcean App Platform isn't pulling Git LFS files.

## 🔄 Fallback: Use DigitalOcean Spaces

### Step 1: Create DigitalOcean Space (5 minutes)

1. Go to: https://cloud.digitalocean.com/spaces
2. Click **"Create Space"**
3. Settings:
   - **Name**: `cruzhacks26-ml-models`
   - **Region**: Same as your app (e.g., NYC3)
   - **Enable CDN**: Yes
   - **File Listing**: Public
4. Click **"Create Space"**

**Cost:** $5/month (250GB storage + 1TB bandwidth)

---

### Step 2: Upload Model to Space (2 minutes)

#### Via Web Interface (Easiest):

1. Go to your Space in DO console
2. Click **"Upload Files"**
3. Select: `/Users/arama/Projects/CruzHacks26/services/ml-core/models/misinfo_model.pkl`
4. Wait for upload (381MB may take 1-2 minutes)
5. Click on uploaded file
6. Click **"Manage"** → **"Make Public"**
7. Copy the **File URL**, looks like:
   ```
   https://cruzhacks26-ml-models.nyc3.cdn.digitaloceanspaces.com/misinfo_model.pkl
   ```

#### Via Command Line (Advanced):

```bash
# Install s3cmd
brew install s3cmd

# Configure (get keys from: DigitalOcean → API → Spaces Keys)
s3cmd --configure

# Upload model
cd /Users/arama/Projects/CruzHacks26/services/ml-core
s3cmd put models/misinfo_model.pkl s3://cruzhacks26-ml-models/misinfo_model.pkl --acl-public

# Get URL
echo "https://cruzhacks26-ml-models.nyc3.cdn.digitaloceanspaces.com/misinfo_model.pkl"
```

---

### Step 3: Switch to External Model Dockerfile (1 minute)

```bash
cd /Users/arama/Projects/CruzHacks26/services/ml-core

# Use the external model version
cp Dockerfile Dockerfile.with-lfs
cp Dockerfile.external-model Dockerfile

# Add to git
git add Dockerfile Dockerfile.with-lfs
git commit -m "Switch to external model storage from DigitalOcean Spaces"
git push origin main
```

---

### Step 4: Add MODEL_URL to App Platform (2 minutes)

1. Go to: https://cloud.digitalocean.com/apps
2. Click your `ml-core-backend` app
3. Go to **"Settings"** → **"Environment Variables"**
4. Click **"Edit"**
5. Add new variable:
   - **Key**: `MODEL_URL`
   - **Value**: `https://cruzhacks26-ml-models.nyc3.cdn.digitaloceanspaces.com/misinfo_model.pkl`
   - **Type**: Regular (not secret)
6. Click **"Save"**

**Note:** This will trigger a new deployment automatically.

---

### Step 5: Verify It Works

After deployment, check logs:

```
✓ Downloading model from Spaces...
✓ Progress: 100% (381MB/381MB)
✓ Model downloaded successfully!
✓ Model loaded into memory
✓ Service ready!
```

---

## 🎯 Quick Decision Tree

### Current Deployment Succeeds?
- **YES** → ✅ Git LFS works! You're done!
- **NO** → Still shows "Model not found"? Continue below...

### Model Not Found After Rebuild?
- **Option A**: Enable Git LFS in DO (check DO docs)
- **Option B**: Use Spaces (follow steps above) ← **Recommended**

---

## 💰 Cost Comparison

| Method | Cost | Pros | Cons |
|--------|------|------|------|
| **Git LFS** | FREE* | Simple, with code | May not work on DO |
| **DO Spaces** | $5/mo | Always works, flexible | Extra service |

*Free for first 1GB storage + 1GB bandwidth/month

---

## ✅ Recommended: Just Use Spaces

**Why?**
- ✅ Guaranteed to work
- ✅ Easy model updates (just upload new file)
- ✅ No git shenanigans
- ✅ Can version models easily
- ✅ Only $5/month

**When to use Git LFS?**
- Your budget is $0
- DigitalOcean supports it
- You want model in version control

---

## 🆘 Quick Commands Reference

### Upload model to Spaces:
```bash
# Web UI: Just drag and drop!
# Or s3cmd:
s3cmd put models/misinfo_model.pkl s3://your-space/misinfo_model.pkl --acl-public
```

### Switch Dockerfile:
```bash
cp Dockerfile.external-model Dockerfile
git add Dockerfile
git commit -m "Use external model storage"
git push origin main
```

### Add environment variable:
```
MODEL_URL=https://your-space.nyc3.cdn.digitaloceanspaces.com/misinfo_model.pkl
```

---

## 📊 What Happens During Download

With external storage, your container:
1. Starts up
2. Checks if model exists locally
3. Downloads from Spaces (takes 1-2 minutes first time)
4. Verifies model file
5. Loads model into memory
6. Starts FastAPI server

**Subsequent restarts:** Model is cached, no re-download needed!

---

## 🎓 Summary

1. **Try current deployment** (should work if Git LFS is supported)
2. **If it fails**, create DO Space and upload model
3. **Switch Dockerfile** to external-model version
4. **Add MODEL_URL** environment variable
5. **Done!** Model downloads at startup

---

Ready to switch? Just follow Steps 1-5 above!
