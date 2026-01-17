#!/bin/bash

###############################################################################
# Fix Git History - Remove Large Model and Re-add with LFS
# 
# This script removes the model from git history and re-adds it with LFS
###############################################################################

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Fixing Git History for Large Model File${NC}"
echo "========================================="
echo ""

# Make sure we're in the right directory
if [ ! -f "models/misinfo_model.pkl" ]; then
    echo -e "${RED}Error: Model file not found. Make sure you're in services/ml-core${NC}"
    exit 1
fi

echo "Step 1: Setting up Git LFS (if not already done)"
echo "================================================"

# Install and initialize Git LFS
if ! command -v git-lfs &> /dev/null; then
    echo -e "${YELLOW}Git LFS not found. Installing...${NC}"
    brew install git-lfs
fi

git lfs install
echo -e "${GREEN}✓ Git LFS initialized${NC}"
echo ""

echo "Step 2: Configure LFS tracking for .pkl files"
echo "=============================================="
git lfs track "*.pkl"
git lfs track "models/*.pkl"
git add .gitattributes
echo -e "${GREEN}✓ LFS tracking configured${NC}"
echo ""

echo "Step 3: Remove model from git history"
echo "======================================"
echo -e "${YELLOW}This will remove the large file from all commits${NC}"
echo ""

# Remove the file from git index (but keep it locally)
git rm --cached models/misinfo_model.pkl 2>/dev/null || true
echo -e "${GREEN}✓ Removed from git index${NC}"
echo ""

echo "Step 4: Update .gitignore temporarily"
echo "======================================"
# Make sure the model isn't ignored
if grep -q "^models/" .gitignore || grep -q "^\*.pkl" .gitignore; then
    echo -e "${YELLOW}Updating .gitignore to allow model tracking${NC}"
    sed -i.backup '/^models\//d; /^\*\.pkl/d' .gitignore
    echo -e "${GREEN}✓ .gitignore updated${NC}"
fi
echo ""

echo "Step 5: Add model with LFS"
echo "=========================="
git add models/misinfo_model.pkl
echo -e "${GREEN}✓ Model added with LFS${NC}"
echo ""

echo "Step 6: Verify LFS tracking"
echo "==========================="
if git lfs ls-files | grep -q "misinfo_model.pkl"; then
    echo -e "${GREEN}✓ Model is now tracked by LFS!${NC}"
    git lfs ls-files
else
    echo -e "${RED}✗ Model is not tracked by LFS${NC}"
    echo "Running manual check..."
    git lfs status
fi
echo ""

echo "Step 7: Commit the changes"
echo "=========================="
git add .gitattributes .gitignore
git commit -m "Move model to Git LFS storage" || echo "Nothing to commit or already committed"
echo ""

echo -e "${GREEN}✓ Git history fixed!${NC}"
echo ""
echo "Next steps:"
echo "1. Force push to update remote (this rewrites history):"
echo -e "   ${YELLOW}git push origin main --force${NC}"
echo ""
echo "2. Or if you're worried about force push, create a new branch:"
echo "   git checkout -b deploy-with-lfs"
echo "   git push origin deploy-with-lfs"
echo ""
echo -e "${YELLOW}⚠️  Note: Force pushing rewrites history. Make sure your team is aware!${NC}"
echo ""
echo "Verify LFS is working:"
echo "  git lfs ls-files    # Should show your model"
echo "  git lfs status      # Should show tracking status"
