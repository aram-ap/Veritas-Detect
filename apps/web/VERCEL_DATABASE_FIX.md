# Vercel Database Timeout Fix

## Problem
Prisma operations timing out on Vercel with error `P1008: Operation has timed out`.

## Root Cause
Serverless functions on Vercel can create many database connections, exhausting the connection pool. The default `pg` Pool configuration wasn't optimized for serverless environments.

## Solution Applied

### 1. Optimized Connection Pool Settings
Updated `/apps/web/src/lib/prisma.ts` with serverless-optimized settings:
- `max: 1` - Limit to 1 connection per serverless function
- `idleTimeoutMillis: 10000` - Close idle connections quickly
- `connectionTimeoutMillis: 5000` - Fail fast on connection issues
- `allowExitOnIdle: true` - Allow pool to clean up properly

### 2. Improved Error Handling
Enhanced `/apps/web/src/app/api/stats/route.ts` with:
- Better logging for debugging
- Specific handling for P1008 timeout errors
- User-friendly error messages

## Deployment Steps

### Step 1: Deploy Updated Code
```bash
cd /Users/arama/Projects/CruzHacks26
git add apps/web/src/lib/prisma.ts apps/web/src/app/api/stats/route.ts
git commit -m "Fix: Optimize Prisma connection pool for Vercel serverless"
git push origin main
```

Vercel will automatically deploy the changes.

### Step 2: Verify Environment Variables in Vercel

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Verify `DATABASE_URL` is set correctly

**Important**: Check if your DigitalOcean database provides a **Connection Pooling URL**:
- Go to your DigitalOcean database dashboard
- Look for "Connection Pooling" or "Connection Details"
- If available, use the **pooled connection string** instead of the direct connection

Example formats:
```bash
# Direct connection (current)
DATABASE_URL="postgresql://user:pass@host:25060/db?sslmode=require"

# Pooled connection (preferred for Vercel)
DATABASE_URL="postgresql://user:pass@host:25061/db?sslmode=require&pgbouncer=true"
```

### Step 3: Optional - Enable DigitalOcean Connection Pooling

If your database doesn't have connection pooling enabled:

1. Log into DigitalOcean
2. Go to your database cluster
3. Navigate to **Connection Pools** tab
4. Create a new connection pool:
   - **Pool Name**: `vercel-pool`
   - **Database**: Your database name
   - **Pool Mode**: `Transaction` (recommended)
   - **Pool Size**: `15-25` (based on your tier)
5. Use the new pooled connection string in Vercel

### Step 4: Monitor After Deployment

Check Vercel logs after deployment:
```bash
vercel logs --follow
```

Look for:
- ✓ Successful database connections
- No more `P1008` timeout errors
- Faster response times on `/api/stats`

## Additional Recommendations

### 1. Connection String Best Practices
In Vercel environment variables, ensure:
- Connection string includes `?sslmode=require`
- Port is correct (usually `25060` for direct, `25061` for pooled)
- Username/password are properly URL-encoded if they contain special characters

### 2. Database Performance
If timeouts persist:
- Check your DigitalOcean database metrics for CPU/memory usage
- Consider upgrading database tier if consistently under load
- Add database indexes if queries are slow (already have indexes on `userId` and `analyzedAt`)

### 3. Alternative: Prisma Data Proxy
For very high traffic, consider using [Prisma Data Proxy](https://www.prisma.io/docs/data-platform/data-proxy):
```bash
# Add to package.json
npm install @prisma/client @prisma/extension-accelerate
```

## Testing

After deployment, test the dashboard:
1. Visit your Vercel URL
2. Log in with Auth0
3. Navigate to `/dashboard`
4. Stats should load without timeout errors

## Rollback (if needed)
If issues persist, you can temporarily increase timeout:
```typescript
// In prisma.ts (temporary workaround)
const pool = new Pool({
  // ... existing config
  statement_timeout: 30000, // 30 seconds
  query_timeout: 30000,
});
```

## Need Help?
- Check DigitalOcean database logs
- Review Vercel function logs
- Ensure database has available connections (not at max limit)
