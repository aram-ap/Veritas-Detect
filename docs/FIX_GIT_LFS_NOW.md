# 🔧 Fix: Model Already in Git History

## Problem
You committed the model BEFORE setting up Git LFS, so it's stuck in git history as a regular file. GitHub rejects the push because of the 100MB limit.

## ⚡ Quick Fix (Run These Commands)

### Option 1: Automated Script (Easiest)

```bash
cd /Users/arama/Projects/CruzHacks26/services/ml-core
./fix-git-history.sh
```

Then push with force:
```bash
git push origin main --force
```

### Option 2: Manual Commands (If you want to understand)

```bash
cd /Users/arama/Projects/CruzHacks26/services/ml-core

# 1. Make sure Git LFS is installed and initialized
git lfs install

# 2. Configure LFS to track .pkl files
git lfs track "*.pkl"
git lfs track "models/*.pkl"
git add .gitattributes

# 3. Remove model from git cache (but keep the file locally)
git rm --cached models/misinfo_model.pkl

# 4. Update .gitignore to allow the model
sed -i.backup '/^models\//d; /^\*\.pkl/d' .gitignore

# 5. Re-add the model (now with LFS)
git add models/misinfo_model.pkl

# 6. Verify it's tracked by LFS
git lfs ls-files
# Should show: models/misinfo_model.pkl

# 7. Commit the changes
git add .gitattributes .gitignore
git commit -m "Move model to Git LFS storage"

# 8. Force push to rewrite history
git push origin main --force
```

## ⚠️ About Force Push

`git push --force` rewrites git history. This is necessary to remove the large file from previous commits.

**If you're the only one working on this repo**: ✅ Safe to force push

**If others have cloned the repo**: ⚠️ Tell them to re-clone or run:
```bash
git fetch origin
git reset --hard origin/main
```

## 🔍 Verify It Worked

After pushing, verify LFS is working:

```bash
# Check what's tracked by LFS
git lfs ls-files

# Should show something like:
# 6e0511b75f * models/misinfo_model.pkl

# Check file size in git
git ls-files -s models/misinfo_model.pkl

# The size shown should be small (a few KB), not 381MB
```

## Alternative: Fresh Branch (Safer)

If you don't want to force push to main, create a fresh branch:

```bash
cd /Users/arama/Projects/CruzHacks26/services/ml-core

# Create and switch to new branch
git checkout -b deploy-with-lfs

# Remove model from cache and re-add with LFS
git rm --cached models/misinfo_model.pkl
git lfs track "*.pkl"
git add .gitattributes models/misinfo_model.pkl

# Commit and push new branch
git commit -m "Use Git LFS for model storage"
git push origin deploy-with-lfs

# Then deploy from this branch instead of main
```

Update `app-spec.yaml` to use the new branch:
```yaml
github:
  repo: aram-ap/Veritas-Web
  branch: deploy-with-lfs  # Changed from 'main'
```

## 🆘 Still Not Working?

### Check if LFS is actually tracking the file:

```bash
git lfs status
git lfs ls-files
```

Should show your model file.

### Check file size in git:

```bash
git ls-tree -r -l HEAD | grep misinfo_model.pkl
```

If it shows 381MB, LFS isn't working. If it shows a few KB, LFS is working!

### Nuclear Option - Remove All History:

If nothing else works, start fresh:

```bash
# WARNING: This deletes all git history!
cd /Users/arama/Projects/CruzHacks26

# Remove .git directory
rm -rf .git

# Re-initialize git
git init
git lfs install
git lfs track "*.pkl"

# Add everything
git add .
git commit -m "Initial commit with Git LFS"

# Force push to remote
git remote add origin https://github.com/aram-ap/Veritas-Web.git
git push origin main --force
```

## ✅ Success Checklist

- [ ] Git LFS installed (`git lfs version`)
- [ ] LFS tracking configured (`git lfs track` shows *.pkl)
- [ ] Model removed from git cache (`git rm --cached`)
- [ ] Model re-added with LFS (`git lfs ls-files` shows model)
- [ ] Changes committed
- [ ] Force pushed to GitHub
- [ ] Push succeeded (no errors)
- [ ] Can see model in GitHub (shows as "Stored with Git LFS")

## 🎯 Expected Outcome

After successful push, in GitHub:
- File will show as "Stored with Git LFS"
- File size shows correctly (381 MB)
- No error messages
- Your DigitalOcean deployment will work!

---

**TL;DR**: Run `./fix-git-history.sh` then `git push origin main --force` 🚀
