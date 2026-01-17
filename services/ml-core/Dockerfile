###############################################################################
# Multi-stage Dockerfile for Misinformation Detection ML Service
# 
# This Dockerfile builds a production-ready container with:
# - Optimized Python 3.10 runtime
# - Pre-trained ML model
# - FastAPI service
#
# Build: docker build -t ml-core:latest .
# Run:   docker run -p 8000:8000 ml-core:latest
###############################################################################

# Stage 1: Builder stage for dependencies
FROM python:3.10-slim as builder

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# Stage 2: Runtime stage
FROM python:3.10-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH"

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv

# Create app user for security (don't run as root)
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app/data /app/models /app/logs && \
    chown -R appuser:appuser /app

# Set working directory
WORKDIR /app

# Copy application code
COPY --chown=appuser:appuser ./src ./src
COPY --chown=appuser:appuser ./requirements.txt .

# Copy the dataset if it exists (optional - can also be mounted as volume)
# COPY --chown=appuser:appuser ./data/dataset.csv ./data/dataset.csv

# Copy pre-trained model for deployment
# ⚠️ IMPORTANT: Model is 381MB and exceeds GitHub's 100MB limit!
# 
# Choose ONE of these options:
#
# Option 1: Use Git LFS (Recommended)
#   - Run: ./setup-git-lfs.sh
#   - Uncomment the line below
#   - Git LFS will handle the large file
#
# Option 2: External Storage (Production)
#   - Use Dockerfile.external-model instead
#   - Store model in DigitalOcean Spaces/S3
#   - Download at runtime
#
# Option 3: Local Development Only
#   - Comment out COPY line below
#   - Mount model as volume: -v $(pwd)/models:/app/models
#
# Uncomment this line only if using Git LFS:
# COPY --chown=appuser:appuser ./models/misinfo_model.pkl ./models/misinfo_model.pkl

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

# Run the application
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

###############################################################################
# Build Instructions:
# 
# 1. Download the Kaggle dataset:
#    - Go to: https://www.kaggle.com/datasets/stevenpeutz/misinformation-fake-news-text-dataset-79k
#    - Download and extract to: ./data/dataset.csv
#
# 2. Train the model locally (before building Docker image):
#    pip install -r requirements.txt
#    python src/training.py
#
# 3. Build the Docker image:
#    docker build -t ml-core:latest .
#
# 4. Run the container:
#    docker run -d -p 8000:8000 \
#      -v $(pwd)/models:/app/models \
#      --name ml-core \
#      ml-core:latest
#
# 5. Alternatively, train inside container:
#    docker run -it -v $(pwd)/data:/app/data -v $(pwd)/models:/app/models ml-core python src/training.py
#
###############################################################################
