# Database Quick Start

## Overview
Your Veritas app is now configured to use DigitalOcean's managed PostgreSQL database instead of local SQLite. This provides better scalability, security, and production-readiness.

## What Changed
- ✅ Prisma schema updated to use PostgreSQL
- ✅ Removed SQLite adapter dependencies
- ✅ Added DigitalOcean setup documentation
- ✅ Environment variables configured
- ✅ Database setup script created

## Quick Setup Steps

### 1. Create Your DigitalOcean Database
Follow the detailed guide in `DIGITALOCEAN_SETUP.md` to:
- Create a DigitalOcean account
- Provision a PostgreSQL database
- Get your connection string

### 2. Update Your Environment Variables
Copy your DigitalOcean connection string and add it to `.env`:

```bash
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"
```

**Important**: Replace with your actual connection string from DigitalOcean!

### 3. Run the Setup Script
```bash
cd apps/web
./setup-database.sh
```

Or manually:
```bash
npx prisma generate
npx prisma migrate deploy
```

### 4. Verify Everything Works
```bash
# Start your app
npm run dev

# In another terminal, open Prisma Studio
npx prisma studio
```

Visit http://localhost:3000/dashboard to test the accounts panel!

## For Local Development

If you want to use a local PostgreSQL for development:

1. **Install PostgreSQL locally**:
   ```bash
   # macOS with Homebrew
   brew install postgresql@16
   brew services start postgresql@16
   
   # Create a database
   createdb veritas_dev
   ```

2. **Set local DATABASE_URL**:
   ```bash
   DATABASE_URL="postgresql://localhost:5432/veritas_dev"
   ```

3. **Run migrations**:
   ```bash
   npx prisma migrate dev
   ```

## Database Schema

Your database has two tables:

### UserProfile
- Stores user information and join date
- Linked to Auth0 user ID

### AnalysisRecord
- Tracks every article analysis
- Records trust score, misinformation detection, and flagged tags
- Used for dashboard statistics

## Troubleshooting

### "DATABASE_URL is not set"
Make sure you have a `.env` file in `/apps/web/` with the DATABASE_URL variable.

### "Connection timeout"
Check that your IP address is added to "Trusted Sources" in DigitalOcean.

### "SSL connection error"
Ensure your connection string includes `?sslmode=require` at the end.

### "Prisma generate fails"
Try deleting `node_modules/.prisma` and running `npx prisma generate` again.

## Production Deployment

When deploying to production:

1. Set DATABASE_URL as an environment variable in your hosting platform
2. Run migrations: `npx prisma migrate deploy`
3. Ensure your production server IP is in DigitalOcean's trusted sources
4. Use connection pooling for better performance
5. Monitor database metrics in DigitalOcean dashboard

## Need Help?

- See `DIGITALOCEAN_SETUP.md` for detailed setup instructions
- Check `env.example` for all required environment variables
- Review Prisma logs with `npx prisma studio`
