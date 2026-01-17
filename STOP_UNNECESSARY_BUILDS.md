# 🛑 Stop Unnecessary Builds in Monorepo

## Problem

In a monorepo, pushing changes to the extension causes:
- ❌ Vercel rebuilds the frontend (unnecessary)
- ❌ DigitalOcean rebuilds the ML backend (unnecessary)
- ⏱️ Wastes 5-10 minutes per push
- 💸 Uses build minutes/credits unnecessarily

## ✅ Solution: Smart Build Detection

Only rebuild what actually changed!

---

## Part 1: Configure Vercel (Frontend)

### Step 1: Add Ignore Build Script

✅ **Already created:** `apps/web/vercel-ignore-build-step.sh`

This script tells Vercel to skip builds when only extension files change.

### Step 2: Configure in Vercel Dashboard

1. Go to: https://vercel.com/dashboard
2. Click your project
3. **Settings** → **Git**
4. Scroll to **"Ignored Build Step"**
5. Select: **"Custom Build Step"**
6. Command:
   ```bash
   bash vercel-ignore-build-step.sh
   ```
7. Click **"Save"**

### How it Works:

```
Push to GitHub
      ↓
Vercel checks: Did apps/web/ change?
      ↓
  YES → Build ✅
   NO → Skip ⏭️
```

---

## Part 2: Configure DigitalOcean (ML Backend)

DigitalOcean App Platform **automatically** detects changes based on the source directory you configured.

### Current Setup:
```yaml
# In app-spec.yaml
source_dir: /services/ml-core
```

This means DigitalOcean **only builds when `services/ml-core/` changes**! ✅

### If Rebuilding Unnecessarily:

Check your app-spec.yaml:

```bash
cd services/ml-core
cat app-spec.yaml | grep source_dir
```

Should show:
```yaml
source_dir: /services/ml-core
```

If not set, update it:

1. Go to: https://cloud.digitalocean.com/apps
2. Click your ML app
3. **Settings** → **App Spec**
4. Edit YAML to include:
   ```yaml
   services:
   - name: ml-api
     source_dir: /services/ml-core
   ```
5. Save

---

## Part 3: Test Build Detection

### Test Scenario 1: Change Extension Only

```bash
# Change something in extension
echo "// test change" >> apps/extension/src/App.tsx

# Commit and push
git add apps/extension/
git commit -m "Update extension UI"
git push origin main
```

**Expected:**
- ✅ Extension: No auto-build (manual)
- ⏭️ Vercel: **Skips build** (no web changes)
- ⏭️ DigitalOcean: **Skips build** (no ml-core changes)

### Test Scenario 2: Change Frontend Only

```bash
# Change something in web
echo "// test change" >> apps/web/src/app/page.tsx

# Commit and push
git add apps/web/
git commit -m "Update frontend"
git push origin main
```

**Expected:**
- ⏭️ Extension: No auto-build
- ✅ Vercel: **Builds** (web files changed)
- ⏭️ DigitalOcean: **Skips build** (no ml-core changes)

### Test Scenario 3: Change ML Backend Only

```bash
# Change something in ml-core
echo "# test change" >> services/ml-core/README.md

# Commit and push
git add services/ml-core/
git commit -m "Update ML backend docs"
git push origin main
```

**Expected:**
- ⏭️ Extension: No auto-build
- ⏭️ Vercel: **Skips build** (no web changes)
- ✅ DigitalOcean: **Builds** (ml-core changed)

---

## Build Matrix

| Changed Files | Extension | Vercel (Web) | DO (ML) |
|---------------|-----------|--------------|---------|
| `apps/extension/` | Manual | ⏭️ Skip | ⏭️ Skip |
| `apps/web/` | Manual | ✅ Build | ⏭️ Skip |
| `services/ml-core/` | Manual | ⏭️ Skip | ✅ Build |
| Root `package.json` | Manual | ✅ Build | ⏭️ Skip* |
| Documentation `*.md` | Manual | ⏭️ Skip | ⏭️ Skip** |

*Unless root dependencies affect ml-core
**Unless in services/ml-core/

---

## Verification Commands

### Check Vercel Build History:
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Check builds
vercel ls
```

### Check DigitalOcean Build History:
```bash
# Using doctl
doctl apps list
doctl apps list-deployments <app-id>
```

Or via web:
- https://cloud.digitalocean.com/apps → Your App → Deployments

---

## Advanced: Multiple Apps in Vercel

If you deploy web AND extension to Vercel separately:

### For Web App:
```bash
# vercel-ignore-build-step.sh
git diff HEAD^ HEAD --quiet apps/web/ || exit 0  # Build if web changed
exit 1  # Skip otherwise
```

### For Extension App:
```bash
# vercel-ignore-build-step.sh
git diff HEAD^ HEAD --quiet apps/extension/ || exit 0  # Build if extension changed
exit 1  # Skip otherwise
```

---

## Troubleshooting

### Vercel still building everything

**Check:**
1. Ignored Build Step is configured
2. Script is executable: `chmod +x vercel-ignore-build-step.sh`
3. Script has no syntax errors: `bash vercel-ignore-build-step.sh`

**Fix:**
```bash
# Test locally
cd apps/web
bash vercel-ignore-build-step.sh
echo $?  # Should be 0 (build) or 1 (skip)
```

### DigitalOcean still building everything

**Check:**
1. `source_dir` is set in app-spec.yaml
2. App Platform is using the app-spec

**Fix:**
Update app-spec.yaml:
```yaml
services:
- name: ml-api
  source_dir: /services/ml-core  # Must be set!
```

### Script returns wrong result

**Debug the script:**
```bash
# Add debug output
echo "🔍 Changed files:"
git diff --name-only HEAD^ HEAD

echo "🔍 Web app changes:"
git diff --name-only HEAD^ HEAD | grep -E '^apps/web/'
```

---

## Best Practices

1. **Keep services isolated** - Each service in its own directory
2. **Use source_dir** - Always specify source directory
3. **Test build detection** - Verify it works before relying on it
4. **Monitor builds** - Check build history regularly
5. **Update scripts** - Adjust patterns as your project evolves

---

## Cost Savings

### Before (rebuilding everything):
- Extension change → 3 builds → ~15 minutes
- Frontend change → 3 builds → ~15 minutes
- Backend change → 3 builds → ~15 minutes

### After (smart detection):
- Extension change → 0 builds → 0 minutes ✅
- Frontend change → 1 build → ~5 minutes ✅
- Backend change → 1 build → ~5 minutes ✅

**Savings:** ~60-80% less build time! 🎉

---

## Quick Reference

```bash
# Vercel: Skip build if no web changes
# Configure in: Settings → Git → Ignored Build Step
bash vercel-ignore-build-step.sh

# DigitalOcean: Auto-detects via source_dir
# Set in: app-spec.yaml → services → source_dir

# Test build detection
git diff HEAD^ HEAD --name-only | grep "^apps/web/"  # Check web changes
git diff HEAD^ HEAD --name-only | grep "^services/ml-core/"  # Check ml changes
```

---

## Summary

✅ **Vercel:** Use ignore build script
✅ **DigitalOcean:** Use `source_dir` in app-spec.yaml
✅ **Extension:** Manual builds only
✅ **Result:** Only build what changed!

**Next step:** Configure Vercel's Ignored Build Step in the dashboard!
