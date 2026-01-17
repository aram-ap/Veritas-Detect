# DigitalOcean Deployment Guide - ML Core Backend

This guide covers deploying the FastAPI ML service to DigitalOcean using two methods:
1. **App Platform** (Recommended - Easiest, fully managed)
2. **Droplet** (More control, manual setup)

## Prerequisites

Before deploying, ensure you have:

1. ✅ **Trained ML Model**: The `models/misinfo_model.pkl` file must exist
2. ✅ **DigitalOcean Account**: Sign up at https://www.digitalocean.com/
3. ✅ **Docker Installed**: For building the container image
4. ✅ **doctl CLI** (Optional but recommended): Install from https://docs.digitalocean.com/reference/doctl/

## Important: Prepare Your Model

**The trained model file cannot be included in git** (it's in `.gitignore`). You have two options:

### Option A: Train Model Locally and Include in Docker Image
```bash
cd services/ml-core

# Make sure you have the dataset (see DATASET_GUIDE.md)
python src/training.py

# Verify model exists
ls -lh models/misinfo_model.pkl
```

### Option B: Use External Storage (Production Recommended)
Upload your trained model to DigitalOcean Spaces or another cloud storage and download it at runtime.

---

## Method 1: DigitalOcean App Platform (Recommended)

App Platform is a fully managed PaaS that handles scaling, monitoring, and SSL automatically.

### Step 1: Prepare Your Repository

1. **Ensure your code is in a Git repository** (GitHub, GitLab, or Bitbucket)
2. **Commit all changes**:
   ```bash
   git add .
   git commit -m "Prepare for DigitalOcean deployment"
   git push origin main
   ```

### Step 2: Modify Dockerfile for App Platform

App Platform requires the model to be included in the image. Update your Dockerfile:

```dockerfile
# Add this section before the final USER appuser line
# Copy the pre-trained model into the image
COPY --chown=appuser:appuser ./models/misinfo_model.pkl ./models/misinfo_model.pkl
```

**Important**: Make sure you've trained the model locally first!

### Step 3: Create App Platform App

#### Option A: Using the Web Console

1. Go to https://cloud.digitalocean.com/apps
2. Click **"Create App"**
3. Choose your **Git provider** and select your repository
4. Configure the service:
   - **Source Directory**: `/services/ml-core`
   - **Autodeploy**: Enable (deploys on every push)
5. Click **"Next"**
6. Configure the web service:
   - **Name**: `ml-core-api`
   - **Environment Variables**:
     ```
     PORT=8000
     GEMINI_API_KEY=your_gemini_api_key_here
     CORS_ORIGINS=https://yourdomain.com
     ```
   - **HTTP Port**: `8000`
   - **HTTP Request Routes**: `/`
   - **Health Check Path**: `/health`
7. Choose your plan:
   - **Basic**: $5/month (512 MB RAM) - Good for testing
   - **Professional**: $12/month (1 GB RAM) - Recommended for production
8. Click **"Next"** → **"Create Resources"**

#### Option B: Using doctl CLI

1. **Install doctl** if you haven't:
   ```bash
   # macOS
   brew install doctl
   
   # Or download from: https://docs.digitalocean.com/reference/doctl/how-to/install/
   ```

2. **Authenticate**:
   ```bash
   doctl auth init
   ```

3. **Create app spec file** (`app-spec.yaml`):
   ```yaml
   name: ml-core-backend
   region: nyc
   
   services:
   - name: api
     source_dir: /services/ml-core
     github:
       repo: your-username/your-repo-name
       branch: main
       deploy_on_push: true
     
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
       value: "your_gemini_api_key_here"
       type: SECRET
     - key: CORS_ORIGINS
       value: "https://yourdomain.com,https://www.yourdomain.com"
     
     instance_count: 1
     instance_size_slug: professional-xs
     
     routes:
     - path: /
   ```

4. **Deploy the app**:
   ```bash
   doctl apps create --spec app-spec.yaml
   ```

5. **Monitor deployment**:
   ```bash
   # List apps
   doctl apps list
   
   # Get app details
   doctl apps get <app-id>
   
   # View logs
   doctl apps logs <app-id> --type run
   ```

### Step 4: Configure Environment Variables

After deployment, add/update environment variables:

```bash
# Using doctl
doctl apps update <app-id> --spec app-spec.yaml

# Or via web console:
# Apps → Your App → Settings → Environment Variables
```

Required environment variables:
- `PORT`: `8000` (default)
- `GEMINI_API_KEY`: Your Gemini API key (get from https://aistudio.google.com/app/apikey)
- `CORS_ORIGINS`: Comma-separated list of allowed origins

Optional:
- `LOG_LEVEL`: `info` (default) or `debug`
- `WORKERS`: Number of uvicorn workers (default: 1)

### Step 5: Test Your Deployment

Once deployed, you'll get a URL like: `https://ml-core-api-xxxxx.ondigitalocean.app`

Test the endpoints:

```bash
# Health check
curl https://your-app-url.ondigitalocean.app/health

# API documentation
open https://your-app-url.ondigitalocean.app/docs

# Test prediction
curl -X POST "https://your-app-url.ondigitalocean.app/predict" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Scientists have discovered a new renewable energy source that could revolutionize the industry.",
    "title": "Breakthrough in Clean Energy"
  }'
```

### Step 6: Connect to Your Frontend

Update your Next.js frontend environment variables:

```bash
# In apps/web/.env
ML_API_URL=https://your-app-url.ondigitalocean.app
```

---

## Method 2: DigitalOcean Droplet (Manual VPS Setup)

This method gives you more control but requires manual server management.

### Step 1: Create a Droplet

1. Go to https://cloud.digitalocean.com/droplets
2. Click **"Create Droplet"**
3. Choose:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic
   - **Size**: $12/month (2 GB RAM, 1 vCPU) minimum
   - **Datacenter**: Choose closest to your users
   - **Authentication**: SSH key (recommended) or password
4. Click **"Create Droplet"**

### Step 2: Initial Server Setup

SSH into your droplet:

```bash
ssh root@your-droplet-ip
```

Update system and install Docker:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Verify installation
docker --version
docker-compose --version
```

### Step 3: Deploy Using Docker

#### Option A: Build on Server

1. **Clone your repository**:
   ```bash
   # Install git if needed
   apt install git -y
   
   # Clone repo
   git clone https://github.com/your-username/your-repo.git
   cd your-repo/services/ml-core
   ```

2. **Copy your trained model to the server**:
   ```bash
   # From your local machine
   scp models/misinfo_model.pkl root@your-droplet-ip:/root/your-repo/services/ml-core/models/
   ```

3. **Create `.env` file**:
   ```bash
   cat > .env << EOF
   PORT=8000
   GEMINI_API_KEY=your_gemini_api_key_here
   CORS_ORIGINS=https://yourdomain.com
   LOG_LEVEL=info
   EOF
   ```

4. **Build and run the container**:
   ```bash
   # Build image
   docker build -t ml-core:latest .
   
   # Run container
   docker run -d \
     --name ml-core \
     --restart unless-stopped \
     -p 8000:8000 \
     --env-file .env \
     -v $(pwd)/models:/app/models \
     ml-core:latest
   
   # Check logs
   docker logs -f ml-core
   ```

#### Option B: Use Pre-built Image from Registry

1. **Push image from your local machine**:
   ```bash
   # Tag image
   docker tag ml-core:latest registry.digitalocean.com/your-registry/ml-core:latest
   
   # Login to DO registry
   doctl registry login
   
   # Push image
   docker push registry.digitalocean.com/your-registry/ml-core:latest
   ```

2. **Pull and run on droplet**:
   ```bash
   # Pull image
   docker pull registry.digitalocean.com/your-registry/ml-core:latest
   
   # Run container
   docker run -d \
     --name ml-core \
     --restart unless-stopped \
     -p 8000:8000 \
     --env-file .env \
     registry.digitalocean.com/your-registry/ml-core:latest
   ```

### Step 4: Setup Nginx Reverse Proxy

Install and configure Nginx for HTTPS and better performance:

```bash
# Install Nginx
apt install nginx -y

# Install Certbot for SSL
apt install certbot python3-certbot-nginx -y

# Create Nginx configuration
cat > /etc/nginx/sites-available/ml-core << 'EOF'
server {
    listen 80;
    server_name api.yourdomain.com;  # Replace with your domain
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable the site
ln -s /etc/nginx/sites-available/ml-core /etc/nginx/sites-enabled/

# Test configuration
nginx -t

# Restart Nginx
systemctl restart nginx

# Get SSL certificate (requires domain pointing to your droplet)
certbot --nginx -d api.yourdomain.com
```

### Step 5: Setup Firewall

Configure UFW firewall:

```bash
# Allow SSH
ufw allow ssh

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw enable

# Check status
ufw status
```

### Step 6: Setup Monitoring (Optional)

Install monitoring tools:

```bash
# Install monitoring agent
curl -sSL https://repos.insights.digitalocean.com/install.sh | bash
```

### Step 7: Auto-deployment with GitHub Actions (Optional)

Create `.github/workflows/deploy.yml` in your repository:

```yaml
name: Deploy to DigitalOcean

on:
  push:
    branches: [ main ]
    paths:
      - 'services/ml-core/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to Droplet
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.DROPLET_IP }}
        username: root
        key: ${{ secrets.SSH_PRIVATE_KEY }}
        script: |
          cd /root/your-repo
          git pull origin main
          cd services/ml-core
          docker-compose down
          docker-compose up -d --build
```

---

## Managing Your Deployment

### View Logs

**App Platform:**
```bash
# Using doctl
doctl apps logs <app-id> --type run --follow

# Or via web console: Apps → Your App → Runtime Logs
```

**Droplet:**
```bash
docker logs -f ml-core
```

### Update Deployment

**App Platform:**
- Push to main branch (if autodeploy enabled)
- Or manually trigger via console/CLI

**Droplet:**
```bash
# Pull latest code
cd /root/your-repo
git pull

# Rebuild and restart
cd services/ml-core
docker-compose down
docker-compose up -d --build
```

### Scale Your App

**App Platform:**
- Go to Apps → Your App → Settings
- Adjust instance count or size

**Droplet:**
- Resize droplet (will require brief downtime)
- Or add more droplets with a load balancer

### Monitor Performance

**App Platform:**
- Built-in metrics in the console
- CPU, Memory, Request rate graphs

**Droplet:**
```bash
# Check container stats
docker stats ml-core

# Check system resources
htop

# Check disk usage
df -h
```

---

## Cost Estimation

### App Platform
- **Basic**: $5/month (512 MB RAM) - Development/Testing
- **Professional**: $12/month (1 GB RAM) - Production
- **Bandwidth**: Included up to limits

### Droplet + Storage
- **Droplet**: $12-24/month (2-4 GB RAM)
- **Bandwidth**: 2-4 TB included
- **Backups**: +20% ($2.40-4.80/month)
- **Spaces** (optional model storage): $5/month (250 GB)

**Recommended for Production**: Professional App Platform ($12/month)

---

## Troubleshooting

### Model Not Found Error

**Problem**: API returns "Model not loaded" error

**Solutions**:
1. Ensure model file is included in Docker image
2. Check if model path is correct in the container:
   ```bash
   docker exec ml-core ls -la /app/models/
   ```
3. Verify model was copied during build:
   ```bash
   # Check Docker build logs
   docker build -t ml-core:latest . --progress=plain
   ```

### Out of Memory

**Problem**: Container crashes with OOM errors

**Solutions**:
1. Upgrade to larger instance (2 GB+ RAM recommended)
2. Reduce model size or features
3. Limit workers: Set `WORKERS=1` in environment

### Slow Predictions

**Problem**: API responses are slow (>5 seconds)

**Solutions**:
1. Upgrade instance size (more CPU cores)
2. Enable response caching (add Redis)
3. Check if Gemini API calls are timing out
4. Use connection pooling for external APIs

### Cannot Connect to API

**Problem**: Cannot reach the API endpoint

**Solutions**:
1. **App Platform**: Check if app is running in console
2. **Droplet**: 
   - Check if container is running: `docker ps`
   - Check firewall: `ufw status`
   - Check Nginx: `systemctl status nginx`
3. Verify DNS records point to correct IP

### SSL Certificate Issues

**Problem**: CORS or SSL errors

**Solutions**:
1. Update CORS_ORIGINS in environment variables
2. Ensure domain has valid SSL certificate
3. For Droplet: Re-run certbot renewal

---

## Security Best Practices

1. **Use Environment Variables**: Never hardcode API keys
2. **Enable HTTPS**: Always use SSL in production
3. **Implement Rate Limiting**: Add rate limiting to prevent abuse
4. **Regular Updates**: Keep Docker images and packages updated
5. **Monitoring**: Set up uptime monitoring and alerts
6. **Backups**: Regular backups of configuration and data
7. **Firewall**: Only expose necessary ports (80, 443)
8. **Non-root User**: Container already runs as non-root (appuser)

---

## Next Steps

After deployment:

1. ✅ Test all endpoints thoroughly
2. ✅ Update frontend to use production API URL
3. ✅ Set up monitoring and alerts
4. ✅ Configure automatic backups
5. ✅ Add custom domain and SSL
6. ✅ Implement API authentication (optional)
7. ✅ Set up CI/CD pipeline (GitHub Actions)

---

## Support and Resources

- **DigitalOcean Docs**: https://docs.digitalocean.com/
- **App Platform Guide**: https://docs.digitalocean.com/products/app-platform/
- **FastAPI Deployment**: https://fastapi.tiangolo.com/deployment/
- **Docker Best Practices**: https://docs.docker.com/develop/dev-best-practices/

---

## Quick Reference Commands

```bash
# App Platform
doctl apps list
doctl apps logs <app-id> --follow
doctl apps update <app-id> --spec app-spec.yaml

# Droplet
docker ps                          # List containers
docker logs -f ml-core            # View logs
docker exec -it ml-core bash      # Access container
docker restart ml-core            # Restart container
systemctl status nginx            # Check Nginx status
certbot renew                     # Renew SSL certificate
ufw status                        # Check firewall

# Monitoring
docker stats ml-core              # Resource usage
htop                              # System resources
df -h                             # Disk usage
```

---

**Ready to deploy?** Choose your method and follow the steps above. For most users, **App Platform is the easiest option** and handles most infrastructure concerns automatically.
