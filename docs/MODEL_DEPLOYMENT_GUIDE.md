# 🚀 Quick Model Deployment Guide

Your model is **381MB** which exceeds GitHub's **100MB** limit. Here are your options:

---

## ⚡ FASTEST: Git LFS (5 minutes)

**Recommended for immediate deployment**

### Step 1: Setup Git LFS
```bash
cd /Users/arama/Projects/CruzHacks26/services/ml-core
./setup-git-lfs.sh
```

### Step 2: Update .gitignore
Git LFS needs to track the model, so remove it from .gitignore:

```bash
# Edit .gitignore and comment out these lines:
# models/
# *.pkl
```

Or run this:
```bash
# Backup .gitignore
cp .gitignore .gitignore.backup

# Remove model ignores temporarily
sed -i.bak '/^models\//d; /^\*\.pkl/d' .gitignore
```

### Step 3: Enable Model Copy in Dockerfile
Uncomment the COPY line in Dockerfile:
```bash
# In Dockerfile, change:
# COPY --chown=appuser:appuser ./models/misinfo_model.pkl ./models/misinfo_model.pkl

# To (remove the #):
COPY --chown=appuser:appuser ./models/misinfo_model.pkl ./models/misinfo_model.pkl
```

### Step 4: Add and Push
```bash
# Stage everything
git add .gitattributes models/misinfo_model.pkl Dockerfile .gitignore

# Commit
git commit -m "Add model with Git LFS"

# Push (this will take a few minutes for 381MB)
git push origin main
```

### Step 5: Deploy
Your DigitalOcean deployment will now work! Git LFS is automatically supported.

**Cost**: FREE (up to 1GB storage, your 381MB fits!)

---

## 🏗️ PRODUCTION: DigitalOcean Spaces (15 minutes)

**Recommended for production deployments**

### Step 1: Create DigitalOcean Space

1. Go to: https://cloud.digitalocean.com/spaces
2. Click **"Create Space"**
3. Configure:
   - **Name**: `cruzhacks26-models` (or any name)
   - **Region**: NYC3 (same as your app)
   - **Enable CDN**: Yes
   - **Make files public**: Yes
4. Click **"Create Space"**

**Cost**: $5/month (250GB storage + 1TB bandwidth)

### Step 2: Upload Model

**Via Web Interface** (Easiest):
1. Go to your Space in DigitalOcean console
2. Click **"Upload Files"**
3. Select `models/misinfo_model.pkl` from your computer
4. Wait for upload (381MB may take 1-2 minutes)
5. Click on the uploaded file
6. Click **"Manage"** → **"Make Public"**
7. Copy the **File URL** (looks like: `https://cruzhacks26-models.nyc3.cdn.digitaloceanspaces.com/misinfo_model.pkl`)

**Via Command Line** (Advanced):
```bash
# Install s3cmd
brew install s3cmd

# Configure (get keys from: DigitalOcean → API → Spaces Keys)
s3cmd --configure

# Upload
s3cmd put models/misinfo_model.pkl s3://cruzhacks26-models/misinfo_model.pkl --acl-public

# Get URL
echo "https://cruzhacks26-models.nyc3.cdn.digitaloceanspaces.com/misinfo_model.pkl"
```

### Step 3: Update Your Deployment

**Switch to external model Dockerfile:**
```bash
cd /Users/arama/Projects/CruzHacks26/services/ml-core

# Rename current Dockerfile
mv Dockerfile Dockerfile.with-model

# Use external model version
mv Dockerfile.external-model Dockerfile
```

**Update app-spec.yaml:**
```yaml
envs:
# Add this new variable:
- key: MODEL_URL
  value: "https://cruzhacks26-models.nyc3.cdn.digitaloceanspaces.com/misinfo_model.pkl"
  # Replace with your actual URL from Step 2
```

**Commit and deploy:**
```bash
git add Dockerfile app-spec.yaml download_model.py
git commit -m "Use external model storage from DigitalOcean Spaces"
git push origin main
```

### Step 4: Deploy
Your app will now download the model at startup from Spaces!

---

## 📊 Comparison

| Method | Setup Time | Cost | Best For |
|--------|------------|------|----------|
| **Git LFS** | 5 min | FREE* | Quick deployment, small teams |
| **DO Spaces** | 15 min | $5/mo | Production, frequent model updates |

*Free tier: 1GB storage + 1GB bandwidth/month (your 381MB fits!)

---

## 🎯 My Recommendation

### Right Now (Today):
**Use Git LFS** - Fastest way to get deployed

### This Week (Production):
**Migrate to Spaces** - Better for production, easier model updates

---

## ⚡ Quick Start Commands

### For Git LFS:
```bash
cd services/ml-core
./setup-git-lfs.sh
# Follow the prompts
git push origin main
```

### For DigitalOcean Spaces:
```bash
cd services/ml-core

# 1. Create Space and upload model (via web interface)

# 2. Switch Dockerfile
mv Dockerfile Dockerfile.with-model
mv Dockerfile.external-model Dockerfile

# 3. Update app-spec.yaml with MODEL_URL

# 4. Deploy
git add .
git commit -m "Use external model storage"
git push origin main
```

---

## 🆘 Troubleshooting

### "This exceeds GitHub's file size limit of 100 MB"
**You need to use Git LFS**. Regular git won't work.
```bash
./setup-git-lfs.sh
```

### "Git LFS: command not found"
**Install Git LFS first:**
```bash
# macOS
brew install git-lfs

# Linux
curl -s https://packagecloud.io/install/repositories/github/git-lfs/script.deb.sh | sudo bash
sudo apt-get install git-lfs
```

### "Model not found" during Docker build
**For Git LFS**: Make sure model is tracked and pushed:
```bash
git lfs ls-files  # Should show your model
git lfs push origin main  # Push LFS files
```

**For Spaces**: Make sure you're using `Dockerfile.external-model` and MODEL_URL is set.

### Model download is slow
**This is normal for 381MB**. First download takes 2-3 minutes. After that, it's cached.

---

## 📚 More Details

See **LARGE_MODEL_SOLUTIONS.md** for comprehensive documentation of all options.

---

## ✅ Checklist

Before deploying, make sure:

- [ ] Choose your method (Git LFS or Spaces)
- [ ] Model file exists locally: `models/misinfo_model.pkl`
- [ ] Run setup script if using Git LFS
- [ ] Upload model to Spaces if using external storage
- [ ] Update Dockerfile (uncomment COPY or use external version)
- [ ] Update app-spec.yaml if using Spaces
- [ ] Test Docker build locally
- [ ] Commit and push changes
- [ ] Deploy to DigitalOcean

---

**Ready?** Pick Git LFS for speed, run `./setup-git-lfs.sh` and you'll be deployed in 10 minutes! 🚀
