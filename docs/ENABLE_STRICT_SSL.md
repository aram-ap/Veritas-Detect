# Enable Strict SSL - Quick Guide

## 🔒 What You Need to Do

Your code is already updated to support strict SSL! You just need to download the CA certificate.

## ⚡ Quick Setup (2 minutes)

### Step 1: Download Certificate

**Option A - Automated Script (Easiest)**
```bash
cd apps/web
./download-ca-cert.sh
```

**Option B - From DigitalOcean Dashboard (Most Secure)**
1. Go to https://cloud.digitalocean.com/databases/
2. Click your database cluster
3. Click "Download CA certificate" in Connection Details
4. Save to `apps/web/certs/ca-certificate.crt`

**Option C - Command Line**
```bash
cd apps/web
mkdir -p certs
curl -o certs/ca-certificate.crt https://raw.githubusercontent.com/digitalocean/marketplace-kubernetes/master/stacks/postgresql/assets/ca-certificate.crt
```

### Step 2: Restart Your Server

```bash
# Stop the dev server (Ctrl+C)
# Clear cache
rm -rf .next

# Restart
npm run dev
```

### Step 3: Verify

When the server starts, you should see:
```
✓ Using strict SSL with CA certificate
```

Instead of:
```
⚠ Using relaxed SSL (self-signed certificates accepted)
```

## ✅ That's It!

Your database connection now uses:
- ✅ Encrypted SSL connection
- ✅ Certificate verification
- ✅ Protection against MITM attacks
- ✅ Production-grade security

## 🔍 How It Works

The code automatically:
1. Checks for CA certificate at `certs/ca-certificate.crt`
2. If found → **Strict SSL** (rejectUnauthorized: true)
3. If not found → **Relaxed SSL** (accepts self-signed certs)
4. Logs which mode is active on startup

## 📁 File Structure

```
apps/web/
├── certs/
│   └── ca-certificate.crt    ← Put certificate here
├── src/
│   └── lib/
│       └── prisma.ts          ← Already updated!
└── .env                       ← Your DATABASE_URL
```

## 🛠️ Environment Variables (Optional)

Add to `.env` for more control:

```bash
# Custom certificate path
DATABASE_SSL_CA_PATH=/path/to/your/certificate.crt

# Disable SSL entirely (not recommended)
DATABASE_SSL=false
```

## 🐛 Troubleshooting

### Still seeing "relaxed SSL" message?
- Check file exists: `ls -lh certs/ca-certificate.crt`
- Verify content: `head certs/ca-certificate.crt`
- Should start with: `-----BEGIN CERTIFICATE-----`
- Restart server after adding certificate

### "certificate verify failed" error?
- Re-download from DigitalOcean dashboard (Option B above)
- This is the most reliable source

### "ENOENT: no such file" error?
- Create directory: `mkdir -p certs`
- Download certificate again

## 📚 More Information

- Full guide: `SSL_SETUP.md`
- General setup: `DIGITALOCEAN_SETUP.md`
- Troubleshooting: `SSL_FIX.md`

## 🚀 Production Deployment

The certificate will be automatically used in production. Make sure to:

1. **Commit the certificate** (if it's a public CA cert):
   ```bash
   git add certs/ca-certificate.crt
   git commit -m "Add DigitalOcean CA certificate for strict SSL"
   ```

2. **Or set as environment variable** in your hosting platform:
   ```bash
   DATABASE_SSL_CA_PATH=/path/to/cert
   ```

3. The code automatically enables strict SSL when the certificate is present

---

**Current Status**: ✅ Code is ready, just download the certificate!
