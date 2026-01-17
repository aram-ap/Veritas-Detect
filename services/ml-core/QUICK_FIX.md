# ⚡ QUICK FIX: Deploy Your 381MB Model NOW

## Problem
Your model is too large for GitHub (381MB > 100MB limit)

## Solution: Use Git LFS (5 minutes)

Run these commands **right now**:

```bash
# 1. Navigate to ml-core directory
cd /Users/arama/Projects/CruzHacks26/services/ml-core

# 2. Install Git LFS (if not already installed)
brew install git-lfs  # macOS
# OR for Linux: curl -s https://packagecloud.io/install/repositories/github/git-lfs/script.deb.sh | sudo bash && sudo apt-get install git-lfs

# 3. Run the setup script
./setup-git-lfs.sh

# 4. Update .gitignore to allow model tracking
# Remove these lines from .gitignore:
#   models/
#   *.pkl

# Quick way to do it:
sed -i.backup '/^models\//d; /^\*\.pkl/d' .gitignore

# 5. Uncomment the model COPY line in Dockerfile
# Find this line in Dockerfile:
#   # COPY --chown=appuser:appuser ./models/misinfo_model.pkl ./models/misinfo_model.pkl
# Remove the # to make it:
#   COPY --chown=appuser:appuser ./models/misinfo_model.pkl ./models/misinfo_model.pkl

# Quick way:
sed -i '' 's/# COPY --chown=appuser:appuser \.\/models\/misinfo_model\.pkl/COPY --chown=appuser:appuser .\/models\/misinfo_model.pkl/' Dockerfile

# 6. Stage all changes
git add .gitattributes models/misinfo_model.pkl Dockerfile .gitignore

# 7. Commit
git commit -m "Add model with Git LFS for deployment"

# 8. Push (this will take a few minutes for 381MB upload)
git push origin main

# 9. Deploy to DigitalOcean
# Your deployment will now work! 🎉
```

## That's It!

Git LFS is **FREE** for your use case (1GB storage, you have 381MB).

Your model is now in GitHub and DigitalOcean App Platform will handle it automatically.

---

## Alternative: Too Complex? Use External Storage Instead

If Git LFS seems complicated, use DigitalOcean Spaces:

1. **Create Space**: https://cloud.digitalocean.com/spaces
2. **Upload `models/misinfo_model.pkl`** via web interface
3. **Make it public** and copy the URL
4. **Run**:
   ```bash
   cd services/ml-core
   mv Dockerfile Dockerfile.original
   mv Dockerfile.external-model Dockerfile
   ```
5. **Update app-spec.yaml**:
   ```yaml
   - key: MODEL_URL
     value: "https://your-space-url/misinfo_model.pkl"
   ```
6. **Deploy**:
   ```bash
   git add .
   git commit -m "Use external model storage"
   git push origin main
   ```

**Cost**: $5/month for Spaces

---

## Need More Help?

- **Git LFS Details**: See `MODEL_DEPLOYMENT_GUIDE.md`
- **All Options**: See `LARGE_MODEL_SOLUTIONS.md`
- **Full Deployment**: See `DIGITALOCEAN_DEPLOYMENT.md`

---

**Recommended**: Just run `./setup-git-lfs.sh` and follow the prompts! ⚡
