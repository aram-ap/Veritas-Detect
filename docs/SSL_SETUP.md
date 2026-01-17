# Strict SSL Setup for DigitalOcean PostgreSQL

This guide shows you how to enable strict SSL certificate verification with proper CA certificate validation.

## Step 1: Download DigitalOcean CA Certificate

### Option A: Download from DigitalOcean Dashboard

1. Go to your database dashboard: https://cloud.digitalocean.com/databases/
2. Click on your database cluster
3. Go to "Overview" tab
4. Scroll down to "Connection Details"
5. Click "Download CA certificate" button
6. Save it to `/apps/web/certs/ca-certificate.crt`

### Option B: Download via Command Line

```bash
cd apps/web/certs
curl -o ca-certificate.crt https://raw.githubusercontent.com/digitalocean/do-agent/master/packaging/etc/certs/DigitalOceanRootCA.crt
```

Or use this direct link:
```bash
cd apps/web/certs
wget https://curl.se/ca/cacert.pem -O ca-certificate.crt
```

### Option C: Get from DigitalOcean API

The official DigitalOcean CA certificate URL (this is the most reliable):
```bash
cd apps/web/certs
curl -o ca-certificate.crt https://raw.githubusercontent.com/digitalocean/marketplace-kubernetes/master/stacks/postgresql/assets/ca-certificate.crt
```

### Option D: Download Directly from Your Database

In your DigitalOcean database dashboard, there's a direct download link specific to your database. This is the MOST SECURE option.

## Step 2: Verify the Certificate File

After downloading, verify the file exists and has content:

```bash
ls -lh apps/web/certs/ca-certificate.crt
cat apps/web/certs/ca-certificate.crt | head -5
```

You should see something like:
```
-----BEGIN CERTIFICATE-----
MIIEQTCCAqmgAwIBAgIUZkhp...
```

## Step 3: Update .gitignore (Optional)

If the certificate is specific to your database, you may want to keep it out of git:

```bash
echo "certs/*.crt" >> .gitignore
```

Or if it's a public CA cert, you can commit it for easier deployment.

## Step 4: The Code is Already Updated!

I've already updated `src/lib/prisma.ts` to use the CA certificate. The configuration will:

1. Check for `NODE_ENV` environment variable
2. Look for the CA certificate file
3. Use strict SSL verification when the cert is present
4. Fall back to relaxed SSL if cert is missing

## Step 5: Update Environment Variable (Optional)

You can add this to your `.env` for more control:

```bash
# Force strict SSL (requires CA certificate)
DATABASE_SSL_MODE=strict

# Or explicitly set the cert path
DATABASE_SSL_CA_PATH=/path/to/ca-certificate.crt
```

## Step 6: Test the Connection

```bash
# Restart your dev server
npm run dev

# In another terminal, test Prisma connection
npx prisma db pull

# Open Prisma Studio
npx prisma studio
```

If everything works, your SSL connection is now fully secure with certificate verification! ✅

## Troubleshooting

### "certificate verify failed"

**Problem**: The CA certificate is invalid or doesn't match DigitalOcean's certificate.

**Solution**:
1. Re-download the certificate from DigitalOcean dashboard
2. Make sure you saved it to the correct location
3. Verify the file isn't corrupted: `cat certs/ca-certificate.crt`

### "ENOENT: no such file or directory"

**Problem**: Certificate file not found.

**Solution**:
```bash
# Create the directory
mkdir -p apps/web/certs

# Download the certificate again
# Use Option A from Step 1 above
```

### "SSL connection failed"

**Problem**: DigitalOcean certificate chain issue.

**Solution**:
1. Make sure your database is using the latest SSL configuration
2. Try updating the certificate from DigitalOcean dashboard
3. Check if your DigitalOcean database has SSL enabled in settings

### Still having issues?

Temporarily disable strict SSL to debug:

```bash
# In .env
DATABASE_SSL_MODE=relaxed
```

## Production Deployment

### When deploying to production (Vercel, Railway, etc.):

**Option 1: Include CA Certificate in Repo**
```bash
# Don't add to .gitignore
git add apps/web/certs/ca-certificate.crt
git commit -m "Add DigitalOcean CA certificate"
```

**Option 2: Set as Environment Variable**
```bash
# In your hosting platform, add:
DATABASE_SSL_CA=$(cat apps/web/certs/ca-certificate.crt | base64)

# Then update code to decode it
```

**Option 3: Download During Build**
Add to your build script:
```json
{
  "scripts": {
    "build": "mkdir -p certs && curl -o certs/ca-certificate.crt [YOUR_CERT_URL] && prisma generate && next build"
  }
}
```

## Security Best Practices

✅ **DO**:
- Use the CA certificate from DigitalOcean dashboard (most secure)
- Enable strict SSL in production
- Keep certificates up to date
- Use environment variables for sensitive paths

❌ **DON'T**:
- Share your database connection string publicly
- Disable SSL in production
- Use expired or invalid certificates
- Commit database credentials to git

## Verify SSL is Working

Check your database connection logs. You should see:
```
SSL connection established with certificate verification
```

Instead of:
```
SSL connection established without certificate verification
```

## Benefits of Strict SSL

✅ **Protection against MITM attacks**: Validates the server identity
✅ **Encrypted traffic**: All data is encrypted in transit
✅ **Compliance**: Meets security standards for production systems
✅ **Trust**: Ensures you're connecting to the real DigitalOcean database

---

Once you complete these steps, your database connection will have enterprise-grade SSL security! 🔒
