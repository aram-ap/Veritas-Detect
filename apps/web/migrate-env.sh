#!/bin/bash

# Script to migrate Auth0 v3 environment variables to v4

echo "🔄 Migrating Auth0 environment variables from v3 to v4..."

if [ ! -f .env.local ]; then
    echo "❌ .env.local not found!"
    exit 1
fi

# Create backup
cp .env.local .env.local.backup
echo "✅ Created backup: .env.local.backup"

# Read existing values
AUTH0_ISSUER_BASE_URL=$(grep -E "^AUTH0_ISSUER_BASE_URL=" .env.local | cut -d'=' -f2 | tr -d "'" | tr -d '"')
AUTH0_BASE_URL=$(grep -E "^AUTH0_BASE_URL=" .env.local | cut -d'=' -f2 | tr -d "'" | tr -d '"')
AUTH0_CLIENT_ID=$(grep -E "^AUTH0_CLIENT_ID=" .env.local | cut -d'=' -f2 | tr -d "'" | tr -d '"')
AUTH0_CLIENT_SECRET=$(grep -E "^AUTH0_CLIENT_SECRET=" .env.local | cut -d'=' -f2 | tr -d "'" | tr -d '"')
AUTH0_SECRET=$(grep -E "^AUTH0_SECRET=" .env.local | cut -d'=' -f2 | tr -d "'" | tr -d '"')
PYTHON_BACKEND_URL=$(grep -E "^PYTHON_BACKEND_URL=" .env.local | cut -d'=' -f2 | tr -d "'" | tr -d '"')
GEMINI_API_KEY=$(grep -E "^GEMINI_API_KEY=" .env.local | cut -d'=' -f2 | tr -d "'" | tr -d '"')

# Extract domain from issuer URL (remove https:// prefix)
AUTH0_DOMAIN=$(echo "$AUTH0_ISSUER_BASE_URL" | sed 's|https://||')

# Generate new secret if needed
if [ "$AUTH0_SECRET" == "use [openssl rand -hex 32] to generate a 32 bytes value" ] || [ -z "$AUTH0_SECRET" ]; then
    AUTH0_SECRET=$(openssl rand -hex 32)
    echo "✅ Generated new AUTH0_SECRET"
fi

# Create new .env.local with v4 variable names
cat > .env.local << EOF
# Auth0 Configuration (v4 SDK)
AUTH0_DOMAIN=$AUTH0_DOMAIN
AUTH0_CLIENT_ID=$AUTH0_CLIENT_ID
AUTH0_CLIENT_SECRET=$AUTH0_CLIENT_SECRET
AUTH0_SECRET=$AUTH0_SECRET
APP_BASE_URL=$AUTH0_BASE_URL

# Backend Configuration
PYTHON_BACKEND_URL=$PYTHON_BACKEND_URL
GEMINI_API_KEY=$GEMINI_API_KEY
EOF

echo ""
echo "✅ Migration complete!"
echo ""
echo "📋 New .env.local contents:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat .env.local
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔄 Please restart your dev server for changes to take effect:"
echo "   npm run dev"
