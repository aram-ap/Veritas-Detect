#!/bin/bash

# Veritas Database Setup Script
# This script helps set up the DigitalOcean PostgreSQL database

set -e

echo "🗄️  Veritas Database Setup"
echo "=========================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL environment variable is not set!"
    echo ""
    echo "Please set it in your .env file:"
    echo 'DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"'
    echo ""
    echo "Follow the DIGITALOCEAN_SETUP.md guide for detailed instructions."
    exit 1
fi

echo "✅ DATABASE_URL is set"
echo ""

# Generate Prisma Client
echo "📦 Generating Prisma Client..."
npx prisma generate

echo ""
echo "🔄 Running database migrations..."
npx prisma migrate deploy

echo ""
echo "✅ Database setup complete!"
echo ""
echo "You can now:"
echo "  - Run 'npm run dev' to start the development server"
echo "  - Run 'npx prisma studio' to view your database"
echo ""
