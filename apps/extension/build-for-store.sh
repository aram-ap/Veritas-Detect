#!/bin/bash

# Script to build and package Chrome extension for Chrome Web Store submission
# This script compiles the extension, cleans it up, and creates a zip file

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${GREEN}🚀 Building Chrome Extension for Chrome Web Store...${NC}"

# Step 1: Clean previous build
echo -e "${YELLOW}📦 Cleaning previous build...${NC}"
if [ -d "dist" ]; then
  rm -rf dist
fi

# Step 2: Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}📥 Installing dependencies...${NC}"
  npm install
fi

# Step 3: Build the extension (production mode)
echo -e "${YELLOW}🔨 Building extension (production mode)...${NC}"
NODE_ENV=production npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
  echo -e "${RED}❌ Build failed! dist directory not found.${NC}"
  exit 1
fi

# Step 4: Copy essential files to dist
echo -e "${YELLOW}📋 Copying manifest and icons...${NC}"

# Copy manifest.json
if [ -f "public/manifest.json" ]; then
  cp public/manifest.json dist/manifest.json
else
  echo -e "${RED}❌ Error: public/manifest.json not found!${NC}"
  exit 1
fi

# Copy icons directory
if [ -d "public/icons" ]; then
  mkdir -p dist/icons
  cp -r public/icons/* dist/icons/
  # Remove any non-essential files from icons (like create_icons.html)
  find dist/icons -name "*.html" -type f -delete 2>/dev/null || true
else
  echo -e "${RED}❌ Error: public/icons directory not found!${NC}"
  exit 1
fi

# Step 5: Clean up unnecessary files for Chrome Web Store
echo -e "${YELLOW}🧹 Cleaning up unnecessary files...${NC}"

# Remove source maps
find dist -name "*.map" -type f -delete 2>/dev/null || true

# Remove any dev/test files that might have been copied
find dist -name "*.test.*" -type f -delete 2>/dev/null || true
find dist -name "*.spec.*" -type f -delete 2>/dev/null || true

# Remove any README or documentation files
find dist -name "README*" -type f -delete 2>/dev/null || true
find dist -name "*.md" -type f -delete 2>/dev/null || true

# Remove any .env files (shouldn't be there, but just in case)
find dist -name ".env*" -type f -delete 2>/dev/null || true

# Remove any hidden files except .gitkeep
find dist -name ".*" ! -name "." ! -name ".." -type f -delete 2>/dev/null || true

# Remove vite.svg or other dev assets if they exist
find dist -name "vite.svg" -type f -delete 2>/dev/null || true
find dist -name "react.svg" -type f -delete 2>/dev/null || true

# Step 6: Get version from manifest for zip naming
if command -v node &> /dev/null; then
  VERSION=$(node -p "require('./public/manifest.json').version" 2>/dev/null || echo "unknown")
  EXTENSION_NAME=$(node -p "require('./public/manifest.json').name" 2>/dev/null | sed 's/[^a-zA-Z0-9]/_/g' || echo "extension")
else
  # Fallback: try to extract with grep/sed if node is not available
  VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' public/manifest.json | sed 's/.*"\([^"]*\)".*/\1/' || echo "unknown")
  EXTENSION_NAME=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' public/manifest.json | sed 's/.*"\([^"]*\)".*/\1/' | sed 's/[^a-zA-Z0-9]/_/g' || echo "extension")
fi

# Step 7: Create zip file
ZIP_NAME="${EXTENSION_NAME}-v${VERSION}-store.zip"
ZIP_PATH="../${ZIP_NAME}"

echo -e "${YELLOW}📦 Creating zip file: ${ZIP_NAME}...${NC}"

# Remove old zip if it exists
if [ -f "$ZIP_PATH" ]; then
  rm "$ZIP_PATH"
fi

# Create zip from dist directory
cd dist
zip -r "$ZIP_PATH" . -x "*.DS_Store" "*.git*" > /dev/null
cd ..

# Verify zip was created
if [ -f "$ZIP_PATH" ]; then
  ZIP_SIZE=$(du -h "$ZIP_PATH" | cut -f1)
  echo -e "${GREEN}✅ Success! Extension packaged: ${ZIP_NAME} (${ZIP_SIZE})${NC}"
  echo -e "${GREEN}📁 Location: $(realpath "$ZIP_PATH")${NC}"
  echo ""
  echo -e "${GREEN}✨ Ready for Chrome Web Store submission!${NC}"
else
  echo -e "${RED}❌ Error: Failed to create zip file!${NC}"
  exit 1
fi
