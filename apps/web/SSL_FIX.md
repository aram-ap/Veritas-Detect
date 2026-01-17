# SSL Certificate Fix for DigitalOcean PostgreSQL

## The Issue
DigitalOcean's managed PostgreSQL uses self-signed SSL certificates, which causes the error:
```
Error opening a TLS connection: self-signed certificate in certificate chain
```

## ✅ Solution Applied

The code has been updated to accept self-signed certificates by default. However, **you need to restart your dev server** for the changes to take effect.

## Steps to Fix

### 1. Stop Your Development Server
Press `Ctrl+C` in the terminal where Next.js is running

### 2. Clear Next.js Cache (Optional but Recommended)
```bash
cd apps/web
rm -rf .next
```

### 3. Restart the Development Server
```bash
npm run dev
```

### 4. Test the Dashboard
Visit http://localhost:3000/dashboard

## Alternative: Update DATABASE_URL

If you're still seeing SSL errors after restarting, you can modify your `DATABASE_URL` in `.env` to disable SSL mode:

```bash
# Change from:
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"

# To (disables SSL, not recommended for production):
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=disable"
```

Or keep SSL but tell the driver to not verify:

```bash
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=no-verify"
```

## What Changed in the Code

**`src/lib/prisma.ts`** now configures the PostgreSQL connection pool with:
```typescript
ssl: { rejectUnauthorized: false }
```

This allows connections to databases with self-signed certificates (like DigitalOcean) while still using encrypted SSL connections.

## Environment Variables

You can also control SSL via environment variable in `.env`:

```bash
# Allow self-signed certificates (default)
# DATABASE_SSL is not set

# Disable SSL entirely (not recommended)
DATABASE_SSL='false'
```

## Production Considerations

For production deployments:

1. **Option 1 - Keep Self-Signed Support** (Current Setup)
   - Works out of the box
   - Still encrypted
   - Doesn't verify certificate chain

2. **Option 2 - Download DigitalOcean CA Certificate**
   - More secure
   - Download the CA cert from DigitalOcean dashboard
   - Configure in your connection:
   ```typescript
   ssl: {
     ca: fs.readFileSync('/path/to/ca-certificate.crt').toString()
   }
   ```

3. **Option 3 - Use Connection Pooler**
   - DigitalOcean's connection pooler
   - Better performance
   - Handles SSL for you

## Verify It's Working

After restarting, you should see:
1. No SSL errors in the console
2. Dashboard loads at http://localhost:3000/dashboard
3. Database queries succeed

## Still Having Issues?

Try these debugging steps:

```bash
# 1. Check your DATABASE_URL is set
echo $DATABASE_URL

# 2. Test PostgreSQL connection directly
cd apps/web
npx prisma db pull

# 3. View database in Prisma Studio
npx prisma studio
```

If you see database tables in Prisma Studio, the connection is working!
