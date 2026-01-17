# Solutions for Large Model Files (381MB)

## Problem

Your trained model (`models/misinfo_model.pkl`) is **381MB**, but:
- ❌ GitHub limits files to **100MB**
- ❌ Docker COPY in Dockerfile will fail if model isn't in the repository
- ❌ DigitalOcean build will fail without the model

## ✅ Solutions (Choose One)

---

## Solution 1: Git LFS (Easiest) ⭐ RECOMMENDED

**Git Large File Storage** allows you to store large files in GitHub.

### Pros:
- ✅ Model stays with your code
- ✅ Easy version control
- ✅ Works seamlessly with DigitalOcean App Platform
- ✅ Free tier: 1GB storage, 1GB bandwidth/month

### Cons:
- ⚠️ Costs after free tier ($5/month per 50GB)
- ⚠️ Requires Git LFS installation

### Setup Steps:

#### Quick Setup (Automated):
```bash
cd services/ml-core
./setup-git-lfs.sh
```

#### Manual Setup:
```bash
# 1. Install Git LFS
brew install git-lfs  # macOS
# OR for Linux: curl -s https://packagecloud.io/install/repositories/github/git-lfs/script.deb.sh | sudo bash && sudo apt-get install git-lfs

# 2. Initialize Git LFS
git lfs install

# 3. Track .pkl files
git lfs track "*.pkl"
git lfs track "models/*.pkl"

# 4. Add .gitattributes
git add .gitattributes

# 5. If model is already tracked by git, remove and re-add with LFS
git rm --cached models/misinfo_model.pkl
git add models/misinfo_model.pkl

# 6. Commit and push
git commit -m "Add model with Git LFS"
git push origin main
```

### Verify It Works:
```bash
# Check what's tracked by LFS
git lfs ls-files

# Should show: models/misinfo_model.pkl
```

### Cost Estimate:
- **Free**: Up to 1GB storage + 1GB bandwidth/month
- **Paid**: $5/month per 50GB data pack (if you exceed free tier)
- Your 381MB model fits in free tier! ✅

---

## Solution 2: External Storage (Most Flexible) ⭐

Store model in cloud storage and download at runtime.

### Pros:
- ✅ No GitHub size limits
- ✅ Easy to update model without redeploying
- ✅ Version model independently from code
- ✅ Can use multiple model versions

### Cons:
- ⚠️ Extra service to manage
- ⚠️ Adds startup time (download on first run)
- ⚠️ Costs for storage (~$5/month for DigitalOcean Spaces)

### Option A: DigitalOcean Spaces (Recommended)

**Setup:**

1. **Create a Space**:
   - Go to: https://cloud.digitalocean.com/spaces
   - Click "Create Space"
   - Name: `cruzhacks26-models`
   - Region: Same as your app (e.g., NYC3)
   - Enable CDN: Yes
   - Cost: $5/month (250GB storage + 1TB transfer)

2. **Upload Your Model**:
   ```bash
   # Install s3cmd or use the web interface
   brew install s3cmd
   
   # Configure (get keys from: API → Spaces Keys)
   s3cmd --configure
   
   # Upload model
   s3cmd put models/misinfo_model.pkl s3://cruzhacks26-models/misinfo_model.pkl --acl-public
   ```
   
   Or use the web interface:
   - Go to your Space
   - Click "Upload Files"
   - Upload `models/misinfo_model.pkl`
   - Make it public (click file → Manage → Make Public)

3. **Get the Public URL**:
   ```
   https://cruzhacks26-models.nyc3.cdn.digitaloceanspaces.com/misinfo_model.pkl
   ```

4. **Update Your Deployment**:
   
   **Use the external model Dockerfile:**
   ```bash
   # Rename files
   mv Dockerfile Dockerfile.original
   mv Dockerfile.external-model Dockerfile
   ```
   
   **Update app-spec.yaml:**
   ```yaml
   envs:
   - key: MODEL_URL
     value: "https://cruzhacks26-models.nyc3.cdn.digitaloceanspaces.com/misinfo_model.pkl"
   ```
   
   **Deploy:**
   ```bash
   git add .
   git commit -m "Use external model storage"
   git push origin main
   ```

### Option B: AWS S3

Similar to Spaces but using AWS:

```bash
# Upload to S3
aws s3 cp models/misinfo_model.pkl s3://your-bucket/misinfo_model.pkl --acl public-read

# Get URL
https://your-bucket.s3.amazonaws.com/misinfo_model.pkl
```

### Option C: Google Cloud Storage

```bash
# Upload to GCS
gsutil cp models/misinfo_model.pkl gs://your-bucket/misinfo_model.pkl
gsutil acl ch -u AllUsers:R gs://your-bucket/misinfo_model.pkl

# Get URL
https://storage.googleapis.com/your-bucket/misinfo_model.pkl
```

---

## Solution 3: Build Without Model (Download Later)

Modify Dockerfile to skip model and download it after deployment.

### Update Dockerfile:

```dockerfile
# Remove or comment out this line:
# COPY --chown=appuser:appuser ./models/misinfo_model.pkl ./models/misinfo_model.pkl

# Add this instead:
RUN mkdir -p /app/models && \
    echo "Model will be downloaded at runtime" > /app/models/README.txt
```

### Then Use Solution 2 (External Storage)

---

## Solution 4: Reduce Model Size (Advanced)

Compress or optimize your model to fit under 100MB.

### Option A: Compression
```python
# compress_model.py
import pickle
import gzip
import joblib

# Load original model
with open('models/misinfo_model.pkl', 'rb') as f:
    model = pickle.load(f)

# Save with compression
joblib.dump(model, 'models/misinfo_model_compressed.pkl', compress=('gzip', 9))
```

### Option B: Model Optimization
```python
# Reduce TF-IDF features
# In training.py, change:
max_features=5000  # Instead of 10000

# This will reduce model size significantly
```

---

## Comparison Table

| Solution | Complexity | Cost | Best For |
|----------|-----------|------|----------|
| **Git LFS** | Low | Free* | Most users |
| **DO Spaces** | Medium | $5/mo | Production |
| **S3/GCS** | Medium | $5-10/mo | Multi-cloud |
| **Model Compression** | High | Free | Size optimization |

*Free for first 1GB storage + 1GB bandwidth/month

---

## 🎯 Recommended Approach

### For Quick Deployment:
**Use Git LFS** - Run `./setup-git-lfs.sh` and push

### For Production:
**Use DigitalOcean Spaces** - More control, easier updates

### For Both:
1. Start with Git LFS for immediate deployment
2. Migrate to Spaces later for production

---

## Step-by-Step: Git LFS (Fastest)

```bash
# 1. Navigate to ml-core
cd services/ml-core

# 2. Run setup script
./setup-git-lfs.sh

# 3. Commit and push
git commit -m "Add model with Git LFS"
git push origin main

# 4. Deploy to DigitalOcean
# Git LFS works automatically with DO App Platform!
```

---

## Step-by-Step: DigitalOcean Spaces

```bash
# 1. Create Space at https://cloud.digitalocean.com/spaces

# 2. Upload model via web interface
# - Go to your Space
# - Upload models/misinfo_model.pkl
# - Make it public

# 3. Update Dockerfile
mv Dockerfile Dockerfile.original
mv Dockerfile.external-model Dockerfile

# 4. Add MODEL_URL to app-spec.yaml
# (See example above)

# 5. Commit and deploy
git add .
git commit -m "Use external model storage"
git push origin main
```

---

## Troubleshooting

### Git LFS: "This exceeds GitHub's file size limit"
**Solution**: Make sure Git LFS is installed and tracking is set up:
```bash
git lfs track
git lfs ls-files
```

### External Storage: "Model download failed"
**Solution**: 
1. Check MODEL_URL is correct and public
2. Test URL in browser: should download the file
3. Check container logs for detailed error

### Docker Build: "Model not found"
**Solution**: 
1. If using Git LFS, make sure it's pushed
2. If using external storage, remove COPY line from Dockerfile
3. Check .gitignore isn't blocking the model

---

## FAQ

### Q: Can I use both Git LFS and external storage?
A: Yes! Use Git LFS for version control, upload to Spaces for serving.

### Q: Will model download on every container restart?
A: No, the download script checks if model exists first.

### Q: How do I update the model in production?
A: 
- **Git LFS**: Push updated model, redeploy
- **Spaces**: Upload new model file, restart containers

### Q: Is Git LFS free forever?
A: Free tier is permanent (1GB storage + 1GB bandwidth/month). Your 381MB model fits!

---

## Next Steps

1. **Choose your solution** (Git LFS recommended for speed)
2. **Follow the steps** for your chosen solution
3. **Update .gitignore** if needed
4. **Test locally** with Docker
5. **Deploy to DigitalOcean**

Need help? Check the troubleshooting section or see DIGITALOCEAN_DEPLOYMENT.md for more details.
