#!/bin/bash

###############################################################################
# Quick Deploy Script for DigitalOcean
# 
# This script helps you deploy the ML Core backend to DigitalOcean App Platform
###############################################################################

set -e

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     ML Core Backend - DigitalOcean Deployment             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Function to prompt for input
prompt() {
    local var_name=$1
    local prompt_text=$2
    local default_value=$3
    
    if [ -n "$default_value" ]; then
        read -p "$(echo -e ${YELLOW}$prompt_text [${default_value}]: ${NC})" value
        value=${value:-$default_value}
    else
        read -p "$(echo -e ${YELLOW}$prompt_text: ${NC})" value
    fi
    
    eval "$var_name='$value'"
}

# Step 1: Run pre-deployment checks
echo -e "${BLUE}Step 1: Running Pre-Deployment Checks${NC}"
echo "========================================"
if [ -f "pre-deploy-check.sh" ]; then
    bash pre-deploy-check.sh
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Pre-deployment checks failed. Please fix the issues above.${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}Warning: pre-deploy-check.sh not found. Continuing anyway...${NC}"
fi
echo ""

# Step 2: Collect deployment information
echo -e "${BLUE}Step 2: Deployment Configuration${NC}"
echo "================================"
echo "Please provide the following information:"
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}Error: Not a git repository. Please initialize git first:${NC}"
    echo "  git init"
    echo "  git add ."
    echo "  git commit -m 'Initial commit'"
    echo "  git remote add origin <your-repo-url>"
    echo "  git push -u origin main"
    exit 1
fi

# Get git remote URL
GIT_REMOTE=$(git config --get remote.origin.url 2>/dev/null || echo "")

if [ -z "$GIT_REMOTE" ]; then
    echo -e "${RED}Error: No git remote found. Please add a remote:${NC}"
    echo "  git remote add origin <your-repo-url>"
    exit 1
fi

# Extract repo owner and name from git URL
if [[ $GIT_REMOTE =~ github.com[:/]([^/]+)/([^/.]+) ]]; then
    DEFAULT_OWNER="${BASH_REMATCH[1]}"
    DEFAULT_REPO="${BASH_REMATCH[2]}"
else
    DEFAULT_OWNER=""
    DEFAULT_REPO=""
fi

prompt REPO_OWNER "GitHub username/organization" "$DEFAULT_OWNER"
prompt REPO_NAME "Repository name" "$DEFAULT_REPO"
prompt BRANCH "Branch to deploy" "main"
prompt APP_NAME "App name in DigitalOcean" "ml-core-backend"

echo ""
echo -e "${BLUE}Step 3: API Configuration${NC}"
echo "========================="

# Check if GEMINI_API_KEY is in .env
if [ -f ".env" ]; then
    GEMINI_KEY=$(grep "^GEMINI_API_KEY=" .env | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "")
fi

if [ -z "$GEMINI_KEY" ] || [[ "$GEMINI_KEY" == "your_"* ]]; then
    echo -e "${YELLOW}Gemini API Key not found in .env${NC}"
    echo "Get your API key from: https://aistudio.google.com/app/apikey"
    prompt GEMINI_KEY "Gemini API Key (or press Enter to skip)"
else
    echo -e "${GREEN}✓ Found Gemini API Key in .env${NC}"
    prompt USE_EXISTING "Use existing key from .env? (y/n)" "y"
    if [[ ! $USE_EXISTING =~ ^[Yy] ]]; then
        prompt GEMINI_KEY "Enter new Gemini API Key"
    fi
fi

prompt CORS_ORIGINS "CORS origins (comma-separated)" "http://localhost:3000,https://yourdomain.com"

echo ""
echo -e "${BLUE}Step 4: Instance Configuration${NC}"
echo "=============================="
echo "Available instance sizes:"
echo "  1. basic-xxs      ($4/month)  - 512 MB RAM, 0.5 vCPU  [Testing only]"
echo "  2. basic-xs       ($5/month)  - 512 MB RAM, 1 vCPU    [Development]"
echo "  3. professional-xs ($12/month) - 1 GB RAM, 1 vCPU     [Recommended]"
echo "  4. professional-s ($24/month) - 2 GB RAM, 2 vCPU     [Production]"
echo ""
prompt INSTANCE_SIZE "Choose instance size (1-4)" "3"

case $INSTANCE_SIZE in
    1) INSTANCE_SLUG="basic-xxs" ;;
    2) INSTANCE_SLUG="basic-xs" ;;
    3) INSTANCE_SLUG="professional-xs" ;;
    4) INSTANCE_SLUG="professional-s" ;;
    *) INSTANCE_SLUG="professional-xs" ;;
esac

prompt REGION "DigitalOcean region (nyc/sfo/ams/sgp/fra/blr)" "nyc"

# Step 5: Generate app-spec.yaml
echo ""
echo -e "${BLUE}Step 5: Generating App Platform Specification${NC}"
echo "=============================================="

cat > app-spec.yaml << EOF
name: ${APP_NAME}
region: ${REGION}

services:
- name: ml-api
  github:
    repo: ${REPO_OWNER}/${REPO_NAME}
    branch: ${BRANCH}
    deploy_on_push: true
  
  source_dir: /services/ml-core
  dockerfile_path: services/ml-core/Dockerfile
  
  http_port: 8000
  
  health_check:
    http_path: /health
    initial_delay_seconds: 60
    period_seconds: 10
    timeout_seconds: 5
    success_threshold: 1
    failure_threshold: 3
  
  envs:
  - key: PORT
    value: "8000"
  
  - key: GEMINI_API_KEY
    value: "${GEMINI_KEY}"
    type: SECRET
  
  - key: CORS_ORIGINS
    value: "${CORS_ORIGINS}"
  
  - key: LOG_LEVEL
    value: "info"
  
  - key: WORKERS
    value: "1"
  
  instance_count: 1
  instance_size_slug: ${INSTANCE_SLUG}
  
  routes:
  - path: /

alerts:
- rule: DEPLOYMENT_FAILED
- rule: DOMAIN_FAILED
EOF

echo -e "${GREEN}✓ Generated app-spec.yaml${NC}"
echo ""

# Step 6: Test Docker build locally
echo -e "${BLUE}Step 6: Testing Docker Build${NC}"
echo "============================"
prompt TEST_BUILD "Test Docker build locally? (y/n)" "y"

if [[ $TEST_BUILD =~ ^[Yy] ]]; then
    echo "Building Docker image (this may take a few minutes)..."
    if docker build -t ml-core:test .; then
        echo -e "${GREEN}✓ Docker build successful${NC}"
        
        # Show image size
        SIZE=$(docker images ml-core:test --format "{{.Size}}")
        echo "Image size: $SIZE"
        
        # Cleanup
        docker rmi ml-core:test &> /dev/null || true
    else
        echo -e "${RED}✗ Docker build failed${NC}"
        echo "Please fix the Docker build errors before deploying."
        exit 1
    fi
fi
echo ""

# Step 7: Commit and push changes
echo -e "${BLUE}Step 7: Git Status${NC}"
echo "=================="

if [[ -n $(git status -s) ]]; then
    echo "You have uncommitted changes:"
    git status -s
    echo ""
    prompt COMMIT_CHANGES "Commit these changes? (y/n)" "y"
    
    if [[ $COMMIT_CHANGES =~ ^[Yy] ]]; then
        prompt COMMIT_MSG "Commit message" "Prepare for DigitalOcean deployment"
        
        git add .
        git commit -m "$COMMIT_MSG"
        echo -e "${GREEN}✓ Changes committed${NC}"
        
        prompt PUSH_CHANGES "Push to remote? (y/n)" "y"
        if [[ $PUSH_CHANGES =~ ^[Yy] ]]; then
            git push origin $BRANCH
            echo -e "${GREEN}✓ Pushed to remote${NC}"
        fi
    fi
else
    echo -e "${GREEN}✓ No uncommitted changes${NC}"
fi
echo ""

# Step 8: Deploy instructions
echo -e "${BLUE}Step 8: Ready to Deploy!${NC}"
echo "========================"
echo ""
echo -e "${GREEN}Your app-spec.yaml has been generated!${NC}"
echo ""
echo "Choose your deployment method:"
echo ""
echo -e "${YELLOW}Option 1: Deploy via Web Console (Easiest)${NC}"
echo "  1. Go to: https://cloud.digitalocean.com/apps"
echo "  2. Click 'Create App'"
echo "  3. Select your GitHub repository: ${REPO_OWNER}/${REPO_NAME}"
echo "  4. Select branch: ${BRANCH}"
echo "  5. Set source directory: /services/ml-core"
echo "  6. Import settings from app-spec.yaml (or configure manually)"
echo "  7. Review and create!"
echo ""
echo -e "${YELLOW}Option 2: Deploy via doctl CLI${NC}"
echo "  Prerequisites:"
echo "    brew install doctl           # Install doctl"
echo "    doctl auth init              # Authenticate"
echo ""
echo "  Deploy command:"
echo -e "    ${GREEN}doctl apps create --spec app-spec.yaml${NC}"
echo ""
echo "  Monitor deployment:"
echo "    doctl apps list"
echo "    doctl apps logs <app-id> --follow"
echo ""
echo -e "${BLUE}Important Notes:${NC}"
echo "  • Your model file (381MB) will be included in the Docker image"
echo "  • First deployment may take 5-10 minutes"
echo "  • You'll get a URL like: https://${APP_NAME}-xxxxx.ondigitalocean.app"
echo "  • Check logs if deployment fails"
echo ""
echo -e "${GREEN}Deployment configuration saved to: app-spec.yaml${NC}"
echo ""
echo "For detailed instructions, see: DIGITALOCEAN_DEPLOYMENT.md"
echo ""
echo -e "${GREEN}Good luck with your deployment! 🚀${NC}"
