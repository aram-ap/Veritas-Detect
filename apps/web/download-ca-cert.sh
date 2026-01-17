#!/bin/bash

# Download DigitalOcean CA Certificate
# This script helps you download the CA certificate for strict SSL

set -e

echo "📜 DigitalOcean CA Certificate Downloader"
echo "=========================================="
echo ""

# Create certs directory
mkdir -p certs

CERT_FILE="certs/ca-certificate.crt"

echo "Choose download method:"
echo ""
echo "1) Download from DigitalOcean's GitHub (Recommended)"
echo "2) Download Mozilla's CA bundle (Works for most providers)"
echo "3) Skip - I'll download manually from DigitalOcean dashboard"
echo ""
read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        echo ""
        echo "Downloading from DigitalOcean's GitHub..."
        curl -fsSL https://raw.githubusercontent.com/digitalocean/marketplace-kubernetes/master/stacks/postgresql/assets/ca-certificate.crt -o "$CERT_FILE"
        ;;
    2)
        echo ""
        echo "Downloading Mozilla's CA bundle..."
        curl -fsSL https://curl.se/ca/cacert.pem -o "$CERT_FILE"
        ;;
    3)
        echo ""
        echo "Please download the CA certificate manually:"
        echo "1. Go to: https://cloud.digitalocean.com/databases/"
        echo "2. Click on your database cluster"
        echo "3. Go to 'Overview' tab"
        echo "4. Scroll to 'Connection Details'"
        echo "5. Click 'Download CA certificate'"
        echo "6. Save it as: $CERT_FILE"
        echo ""
        echo "This is the MOST SECURE option as it's specific to your database."
        exit 0
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

# Verify the download
if [ -f "$CERT_FILE" ]; then
    echo ""
    echo "✅ Certificate downloaded successfully!"
    echo ""
    echo "Verifying certificate..."
    if grep -q "BEGIN CERTIFICATE" "$CERT_FILE"; then
        echo "✅ Certificate format is valid"
        echo ""
        echo "Certificate saved to: $CERT_FILE"
        echo ""
        echo "Next steps:"
        echo "1. Restart your dev server: npm run dev"
        echo "2. You should see: '✓ Using strict SSL with CA certificate'"
        echo "3. Test connection: npx prisma studio"
        echo ""
        echo "Your database now uses strict SSL with certificate verification! 🔒"
    else
        echo "⚠️  Warning: File doesn't look like a valid certificate"
        echo "Please try downloading manually from DigitalOcean dashboard"
    fi
else
    echo "❌ Download failed"
    echo "Please download manually from: https://cloud.digitalocean.com/databases/"
    exit 1
fi
