#!/bin/bash

###############################################################################
# Pre-Deployment Checklist Script for ML Core Backend
# Run this script before deploying to DigitalOcean
###############################################################################

set -e

echo "🚀 ML Core Pre-Deployment Checklist"
echo "===================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to check if file exists
check_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description: $file"
    else
        echo -e "${RED}✗${NC} $description: $file (MISSING)"
        ((ERRORS++))
    fi
}

# Function to check directory
check_dir() {
    local dir=$1
    local description=$2
    
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $description: $dir"
    else
        echo -e "${RED}✗${NC} $description: $dir (MISSING)"
        ((ERRORS++))
    fi
}

# Function to check environment variable
check_env() {
    local var=$1
    local description=$2
    
    if [ -f ".env" ] && grep -q "^${var}=" .env; then
        local value=$(grep "^${var}=" .env | cut -d'=' -f2 | tr -d '"' | tr -d "'")
        if [ -n "$value" ] && [ "$value" != "YOUR_" ] && [ "$value" != "your_" ]; then
            echo -e "${GREEN}✓${NC} $description: $var (configured)"
        else
            echo -e "${YELLOW}⚠${NC} $description: $var (needs value)"
            ((WARNINGS++))
        fi
    else
        echo -e "${YELLOW}⚠${NC} $description: $var (not set)"
        ((WARNINGS++))
    fi
}

echo "1. Checking Critical Files"
echo "-------------------------"
check_file "Dockerfile" "Dockerfile"
check_file "requirements.txt" "Requirements file"
check_file "src/main.py" "Main application"
check_file "src/inference.py" "Inference module"
echo ""

echo "2. Checking Trained Model"
echo "-------------------------"
check_file "models/misinfo_model.pkl" "Trained ML model"

if [ -f "models/misinfo_model.pkl" ]; then
    SIZE=$(du -h models/misinfo_model.pkl | cut -f1)
    echo "   Model size: $SIZE"
    
    if [ -n "$SIZE" ]; then
        echo -e "${GREEN}✓${NC} Model file is present and has size: $SIZE"
    fi
fi
echo ""

echo "3. Checking Configuration"
echo "-------------------------"
check_file ".env" "Environment file"
if [ -f ".env" ]; then
    check_env "GEMINI_API_KEY" "Gemini API Key"
    check_env "CORS_ORIGINS" "CORS Origins"
    check_env "PORT" "Port"
fi
echo ""

echo "4. Checking Deployment Files"
echo "-----------------------------"
check_file "app-spec.yaml" "App Platform spec"
echo ""

echo "5. Testing Docker Build"
echo "----------------------"
if command -v docker &> /dev/null; then
    echo "Docker is installed"
    
    read -p "Do you want to test the Docker build? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Building Docker image (this may take a few minutes)..."
        if docker build -t ml-core:test . --quiet; then
            echo -e "${GREEN}✓${NC} Docker build successful"
            
            # Check image size
            SIZE=$(docker images ml-core:test --format "{{.Size}}")
            echo "   Image size: $SIZE"
            
            # Cleanup test image
            docker rmi ml-core:test &> /dev/null || true
        else
            echo -e "${RED}✗${NC} Docker build failed"
            ((ERRORS++))
        fi
    fi
else
    echo -e "${YELLOW}⚠${NC} Docker not installed - skipping build test"
    ((WARNINGS++))
fi
echo ""

echo "6. Checking Git Status"
echo "----------------------"
if command -v git &> /dev/null; then
    if [ -d ".git" ]; then
        # Check if there are uncommitted changes
        if [[ -n $(git status -s) ]]; then
            echo -e "${YELLOW}⚠${NC} You have uncommitted changes:"
            git status -s
            echo "   Consider committing before deployment"
            ((WARNINGS++))
        else
            echo -e "${GREEN}✓${NC} Working directory is clean"
        fi
        
        # Check current branch
        BRANCH=$(git rev-parse --abbrev-ref HEAD)
        echo "   Current branch: $BRANCH"
        
        # Check if branch has remote
        if git rev-parse --abbrev-ref --symbolic-full-name @{u} &> /dev/null; then
            echo -e "${GREEN}✓${NC} Branch has remote tracking"
            
            # Check if local is behind remote
            LOCAL=$(git rev-parse @)
            REMOTE=$(git rev-parse @{u})
            
            if [ "$LOCAL" = "$REMOTE" ]; then
                echo -e "${GREEN}✓${NC} Local and remote are in sync"
            else
                echo -e "${YELLOW}⚠${NC} Local and remote are out of sync"
                echo "   Run 'git pull' or 'git push' to sync"
                ((WARNINGS++))
            fi
        else
            echo -e "${YELLOW}⚠${NC} Branch is not tracking a remote"
            echo "   You may need to push: git push -u origin $BRANCH"
            ((WARNINGS++))
        fi
    else
        echo -e "${RED}✗${NC} Not a git repository"
        ((ERRORS++))
    fi
else
    echo -e "${YELLOW}⚠${NC} Git not installed"
    ((WARNINGS++))
fi
echo ""

echo "7. Deployment Readiness"
echo "-----------------------"

# Calculate total issues
TOTAL_ISSUES=$((ERRORS + WARNINGS))

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Ready for deployment.${NC}"
    echo ""
    echo "Next Steps:"
    echo "1. Review and update app-spec.yaml with your repository details"
    echo "2. Ensure your GEMINI_API_KEY is set in the .env file"
    echo "3. Commit and push your changes to GitHub"
    echo "4. Follow the deployment guide in DIGITALOCEAN_DEPLOYMENT.md"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) found.${NC}"
    echo "Review the warnings above and consider addressing them."
    echo ""
    echo "You can proceed with deployment, but review the warnings first."
    exit 0
else
    echo -e "${RED}✗ $ERRORS error(s) and $WARNINGS warning(s) found.${NC}"
    echo ""
    echo "Please fix the errors above before deploying."
    echo ""
    echo "Common fixes:"
    echo "- Train model: python src/training.py"
    echo "- Create .env: cp .env.example .env"
    echo "- Initialize git: git init && git add . && git commit -m 'Initial commit'"
    exit 1
fi
