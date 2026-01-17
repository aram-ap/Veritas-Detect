# Dashboard Troubleshooting Guide

## Quick Diagnosis

### Test Dashboard Access

1. **Go to:** `https://your-app.vercel.app/dashboard`
2. **What do you see?**

---

## Common Issues & Fixes

### Issue 1: "Please sign in to view your dashboard"

**Cause:** Not authenticated or session expired

**Fix:**
1. Click "Sign In" button
2. Complete Auth0 login
3. Should redirect back to dashboard

---

### Issue 2: Blank/White Page

**Cause:** JavaScript error or build issue

**Fix:**
1. Open browser console (F12)
2. Check for errors
3. Look for:
   ```
   Error: Failed to fetch stats
   ```

**If you see this:** API endpoint issue (see Issue 3)

---

### Issue 3: "Failed to load statistics"

**Cause:** `/api/stats` endpoint not working

**Check:**
```bash
# Test the stats endpoint directly
curl https://your-app.vercel.app/api/stats \
  -H "Cookie: appSession=your-session-cookie"
```

**Fix:**
1. Check if database is connected
2. Verify `DATABASE_URL` env variable in Vercel
3. Check Vercel logs for database errors

---

### Issue 4: 404 Not Found

**Cause:** Route not deployed or build issue

**Fix:**
1. Check if `/dashboard` route exists:
   ```bash
   ls apps/web/src/app/dashboard/page.tsx
   ```
2. Redeploy if file exists but 404 persists:
   ```bash
   # In Vercel dashboard: Deployments → Redeploy
   ```

---

### Issue 5: Loading Forever

**Cause:** API call hanging or slow database

**Fix:**
1. Open browser DevTools → Network tab
2. Check which request is pending
3. If `/api/stats` is slow:
   - Check database connection
   - Check database query performance
   - Verify database is not paused/sleeping

---

## Debug Steps

### Step 1: Check Authentication

```javascript
// Open browser console on /dashboard
// Type:
fetch('/api/auth/me').then(r => r.json()).then(console.log)

// Should show user object if authenticated
// Or redirect to login if not
```

### Step 2: Check Stats API

```javascript
// Open browser console
fetch('/api/stats').then(r => r.json()).then(console.log)

// Should show stats object or error
```

### Step 3: Check Database Connection

```bash
# Check Vercel logs
vercel logs --follow

# Or in Vercel dashboard:
# Functions → Select api/stats → View Logs
```

---

## Quick Fixes

### Fix 1: Clear Cookies and Re-login

```javascript
// In browser console
document.cookie.split(";").forEach(c => {
  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
});
location.href = '/api/auth/login';
```

### Fix 2: Force Redeploy

```bash
# Using Vercel CLI
cd apps/web
vercel --prod

# Or in dashboard:
# Deployments → Latest → Redeploy
```

### Fix 3: Check Environment Variables

Required in Vercel:
```bash
DATABASE_URL=postgresql://...
AUTH0_SECRET=...
AUTH0_BASE_URL=https://your-app.vercel.app
AUTH0_ISSUER_BASE_URL=https://your-domain.auth0.com
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
```

---

## Logs to Check

### Vercel Function Logs:
1. Go to Vercel dashboard
2. Functions tab
3. Click on `/api/stats`
4. View invocation logs

### Browser Console:
1. F12 → Console tab
2. Look for red errors
3. Check Network tab for failed requests

### Database Logs:
1. DigitalOcean → Databases
2. Your PostgreSQL database
3. Check connection count
4. Check for errors

---

## Expected Behavior

### When Dashboard Works:
1. ✅ Redirects to login if not authenticated
2. ✅ Shows loading state briefly
3. ✅ Displays stats cards with numbers
4. ✅ Shows chart if data exists
5. ✅ Shows recent analyses list

### What You Should See:
- Member since date
- Total articles analyzed count
- Misinformation detected count
- Bar chart of flagged tags (if any analyses done)
- List of recent analyses

---

## Still Not Working?

### Provide This Info:

1. **What URL are you accessing?**
   ```
   https://your-app.vercel.app/dashboard
   ```

2. **What do you see?**
   - [ ] Blank white page
   - [ ] "Please sign in" message
   - [ ] Error message (what does it say?)
   - [ ] Loading spinner forever
   - [ ] Something else?

3. **Browser console errors:**
   ```
   (Paste any red errors from F12 console)
   ```

4. **Network tab:**
   - Which API calls are failing?
   - What status codes? (404, 500, etc)

5. **Are you signed in?**
   - Yes/No
   - Can you see your profile picture in nav?

---

## Test Checklist

- [ ] Can access home page: `/`
- [ ] Can sign in: `/api/auth/login`
- [ ] Can access dashboard: `/dashboard`
- [ ] Dashboard shows stats (even if 0)
- [ ] Can sign out
- [ ] Database connection works
- [ ] Stats API returns data: `/api/stats`

---

## Quick Test Script

```javascript
// Run this in browser console on /dashboard
async function testDashboard() {
  console.log('1. Testing auth...');
  const auth = await fetch('/api/auth/me').then(r => r.json());
  console.log('Auth:', auth);
  
  console.log('2. Testing stats...');
  const stats = await fetch('/api/stats').then(r => r.json());
  console.log('Stats:', stats);
  
  console.log('✅ Dashboard should work!');
}

testDashboard();
```

---

**What error are you seeing exactly?** That will help me pinpoint the issue!
