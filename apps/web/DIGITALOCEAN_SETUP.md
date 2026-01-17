# DigitalOcean PostgreSQL Database Setup Guide

This guide will help you set up a DigitalOcean Managed PostgreSQL database for your Veritas application.

## Step 1: Create a DigitalOcean Account

1. Go to [DigitalOcean](https://www.digitalocean.com/)
2. Sign up for an account (you may get free credits for new users)
3. Complete the account verification process

## Step 2: Create a Managed PostgreSQL Database

1. **Log in to DigitalOcean Dashboard**
   - Navigate to https://cloud.digitalocean.com/

2. **Create Database**
   - Click on "Create" → "Databases"
   - Or go directly to: https://cloud.digitalocean.com/databases/new

3. **Configure Your Database**
   - **Database Engine**: Select **PostgreSQL**
   - **Version**: Choose the latest stable version (PostgreSQL 16 or 17)
   - **Datacenter Region**: Choose a region close to your users or your app server
   - **Database Cluster Size**: 
     - For development/testing: **Basic** plan (starts at $15/month)
     - For production: Consider **Professional** plan for better performance
   - **Choose a Name**: e.g., `veritas-prod-db`

4. **Click "Create Database Cluster"**
   - This will take a few minutes to provision

## Step 3: Configure Database Security

1. **Add Trusted Sources**
   - In your database dashboard, go to "Settings" → "Trusted Sources"
   - Add your IP addresses that need access:
     - Your local development machine IP
     - Your production server IP (if deploying)
     - Or enable "Allow all IP addresses" for development (not recommended for production)

2. **Connection Pool** (Optional but Recommended)
   - Go to "Connection Pools" tab
   - Create a new connection pool:
     - Name: `veritas-pool`
     - Database: `defaultdb` (or create a new database)
     - Mode: `Transaction` (recommended for web apps)
     - Size: 15 (adjust based on your needs)

## Step 4: Get Your Connection String

1. **Navigate to Overview Tab**
   - You'll see "Connection Details" section

2. **Connection Parameters** - Two options:

   ### Option A: Direct Connection (Simpler)
   ```
   postgresql://username:password@host:port/database?sslmode=require
   ```

   ### Option B: Connection Pool (Recommended for Production)
   ```
   postgresql://username:password@host:port/database?sslmode=require
   ```

3. **Copy the Connection String**
   - Click on "Connection string" dropdown
   - Select "Connection string"
   - Copy the full connection string
   - **Important**: Make sure it includes `?sslmode=require` at the end

### SSL Configuration Note

DigitalOcean uses SSL for secure connections. The app is configured to:
- **Development**: Accept self-signed certificates (for easier testing)
- **Production**: Require valid SSL certificates

For production with strict SSL verification, you can download the CA certificate from DigitalOcean and configure it in the connection.

## Step 5: Update Your Environment Variables

1. **Update `.env` file** in `/apps/web/`:
   ```bash
   DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"
   ```

2. **Important**: Replace the connection string with your actual credentials from DigitalOcean

3. **Never commit `.env`** - Make sure it's in `.gitignore`

## Step 6: Run Database Migrations

Once you've set up your DATABASE_URL, run the following commands:

```bash
# Navigate to web app directory
cd apps/web

# Generate Prisma client
npx prisma generate

# Run migrations to create tables
npx prisma migrate deploy

# Or for development with migration history
npx prisma migrate dev --name init
```

## Step 7: Verify Connection

Test your database connection:

```bash
# Open Prisma Studio to view your database
npx prisma studio
```

Or test by starting your Next.js app:

```bash
npm run dev
```

Then visit http://localhost:3000/dashboard to see if the stats load correctly.

## Database Management

### View Database in DigitalOcean Console
- Go to your database dashboard
- Click on "Users & Databases" to manage databases
- Click on "Connection Pools" to manage connection pools

### Backup Your Database
DigitalOcean automatically creates daily backups for managed databases. You can restore from these backups in the "Backups" tab.

### Monitor Performance
- View metrics in the "Insights" tab
- Monitor connection count, CPU usage, memory usage
- Set up alerts for high resource usage

## Production Considerations

1. **Connection Pooling**: Always use connection pools in production
2. **SSL Mode**: Keep `sslmode=require` for secure connections
3. **Environment Variables**: Use environment variables management in your deployment platform
4. **Trusted Sources**: Restrict IP addresses to only necessary IPs
5. **Monitoring**: Set up alerts for database performance
6. **Backups**: Verify automated backups are working
7. **Scaling**: Monitor database size and upgrade plan if needed

## Cost Optimization

- **Basic Plan**: $15/month - Good for small projects
- **Professional Plan**: $60/month+ - Better performance and standby nodes
- **Pause during development**: You can destroy and recreate databases for testing

## Troubleshooting

### Connection Timeout
- Check if your IP is in "Trusted Sources"
- Verify the connection string is correct
- Ensure `sslmode=require` is in the connection string

### Migration Errors
- Make sure DATABASE_URL is set correctly
- Run `npx prisma generate` before migrations
- Check database logs in DigitalOcean console

### Performance Issues
- Consider upgrading to a larger database plan
- Enable connection pooling
- Check slow query logs in DigitalOcean

## Need Help?

- [DigitalOcean Database Documentation](https://docs.digitalocean.com/products/databases/)
- [Prisma PostgreSQL Guide](https://www.prisma.io/docs/concepts/database-connectors/postgresql)
- [Veritas Project Issues](https://github.com/your-repo/issues)
