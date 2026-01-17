#!/bin/bash

###############################################################################
# Setup Git LFS for Large Model Files
# This script helps you set up Git Large File Storage for your ML model
###############################################################################

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Setting up Git LFS for ML Model${NC}"
echo "=================================="
echo ""

# Check if git-lfs is installed
if ! command -v git-lfs &> /dev/null; then
    echo -e "${YELLOW}Git LFS is not installed.${NC}"
    echo ""
    echo "Installing Git LFS..."
    
    # Detect OS and install
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "Detected macOS - installing via Homebrew..."
        brew install git-lfs
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "Detected Linux - installing..."
        curl -s https://packagecloud.io/install/repositories/github/git-lfs/script.deb.sh | sudo bash
        sudo apt-get install git-lfs
    else
        echo -e "${RED}Unsupported OS. Please install Git LFS manually:${NC}"
        echo "https://git-lfs.github.com/"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Git LFS is already installed${NC}"
fi

echo ""
echo "Initializing Git LFS in repository..."
git lfs install

echo ""
echo "Configuring Git LFS to track .pkl files..."
git lfs track "*.pkl"
git lfs track "models/*.pkl"

echo ""
echo "Adding .gitattributes..."
git add .gitattributes

echo ""
echo -e "${GREEN}✓ Git LFS setup complete!${NC}"
echo ""

# Check if model file exists
if [ -f "models/misinfo_model.pkl" ]; then
    SIZE=$(du -h models/misinfo_model.pkl | cut -f1)
    echo -e "${BLUE}Model file found: models/misinfo_model.pkl ($SIZE)${NC}"
    echo ""
    
    # Check if it's already tracked by git
    if git ls-files --error-unmatch models/misinfo_model.pkl 2>/dev/null; then
        echo -e "${YELLOW}Warning: Model is already tracked by regular git${NC}"
        echo "You need to remove it from git and re-add it with LFS:"
        echo ""
        echo "  git rm --cached models/misinfo_model.pkl"
        echo "  git add models/misinfo_model.pkl"
        echo "  git commit -m 'Move model to Git LFS'"
        echo ""
        read -p "Do you want me to do this now? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git rm --cached models/misinfo_model.pkl
            git add models/misinfo_model.pkl
            echo -e "${GREEN}✓ Model moved to Git LFS tracking${NC}"
        fi
    else
        echo "Adding model to git with LFS..."
        git add models/misinfo_model.pkl
        echo -e "${GREEN}✓ Model added with Git LFS${NC}"
    fi
    
    echo ""
    echo "Next steps:"
    echo "1. Commit the changes:"
    echo "   git commit -m 'Add model with Git LFS'"
    echo ""
    echo "2. Push to GitHub:"
    echo "   git push origin main"
    echo ""
    echo -e "${YELLOW}Note: First push with LFS may take a few minutes for 381MB file${NC}"
else
    echo -e "${RED}Warning: Model file not found at models/misinfo_model.pkl${NC}"
    echo "Make sure you've trained your model first!"
fi

echo ""
echo -e "${GREEN}Git LFS is now configured!${NC}"
echo ""
echo "Files tracked by LFS:"
git lfs track
