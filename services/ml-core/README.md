# ML Core - Misinformation Detection Service

A production-ready FastAPI service for detecting misinformation and political bias in news articles using machine learning.

## Features

- **Misinformation Detection**: Uses TF-IDF + PassiveAggressiveClassifier trained on 79k news articles
- **Trust Score**: Returns a calibrated 0-100 trust score (higher = more trustworthy)
- **Political Bias Detection**: Identifies Left/Center/Right political bias using keyword analysis
- **AI-Powered Sentence Flagging**: Gemini identifies problematic sentences and categorizes them as Misinformation, Disinformation, or Propaganda
- **Smart Explanations**: Gemini-powered explanations for trust scores (falls back to rule-based if unavailable)
- **Fact-Checking**: Gemini verifies key claims in articles
- **REST API**: FastAPI-powered endpoints with automatic documentation
- **Docker Support**: Containerized for easy deployment to DigitalOcean or any cloud platform

## Architecture

```
services/ml-core/
├── data/                       # Dataset storage (gitignored)
│   ├── DataSet_Misinfo_FAKE.csv   # Fake news dataset
│   ├── DataSet_Misinfo_TRUE.csv   # Real news dataset
│   └── dataset.csv                # Combined dataset (generated)
├── models/                     # Trained model storage (gitignored)
│   └── misinfo_model.pkl      # Trained TF-IDF + Classifier
├── scripts/                    # Utility scripts
│   └── prepare_dataset.py     # Combine FAKE + TRUE datasets
├── src/                        # Source code
│   ├── main.py                # FastAPI application
│   ├── training.py            # Model training script
│   ├── inference.py           # Prediction and analysis
│   └── preprocessing.py       # Text cleaning utilities
├── Dockerfile                  # Production container
├── docker-compose.yml          # Development orchestration
├── requirements.txt            # Python dependencies
├── setup.sh                    # Automated setup script
└── README.md                   # Documentation
```

## Quick Start

### 1. Download the Dataset

1. Go to [Kaggle Dataset](https://www.kaggle.com/datasets/stevenpeutz/misinformation-fake-news-text-dataset-79k)
2. Download the dataset (it contains two CSV files)
3. Place them in `services/ml-core/data/`:
   - `DataSet_Misinfo_FAKE.csv`
   - `DataSet_Misinfo_TRUE.csv`

**Note:** You may need to create a Kaggle account and accept the dataset terms.

### 2. Install Dependencies

```bash
cd services/ml-core
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Prepare the Dataset

The dataset comes in two separate files (FAKE and TRUE). Combine them:

```bash
python scripts/prepare_dataset.py
```

This script will:
- Load both CSV files
- Add labels (0=Fake, 1=True)
- Combine and shuffle the data
- Save to `data/dataset.csv`

Expected output:
```
✓ Found: data/DataSet_Misinfo_FAKE.csv
✓ Found: data/DataSet_Misinfo_TRUE.csv
  Loaded 39000 fake news articles
  Loaded 40000 real news articles
  Total articles: 79000
  ✓ Dataset saved successfully!
```

### 4. Train the Model

```bash
python src/training.py
```

Expected output:
```
Loading dataset from data/dataset.csv...
Loaded 79000 samples
Training TF-IDF Vectorizer...
Training PassiveAggressiveClassifier...
Accuracy: 0.9324 (93.24%)
F1-Score: 0.9321
Model saved successfully!
```

This will create `models/misinfo_model.pkl` (~5-10 MB).

### 5. Run the Service Locally

```bash
# Development mode with auto-reload
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Production mode
uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 4
```

Access the API:
- **Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

## API Usage

### POST /predict

Analyze a news article for misinformation and bias.

**Request:**
```json
{
  "text": "This is the full article text to analyze...",
  "title": "Article Headline (optional)"
}
```

**Response:**
```json
{
  "trust_score": 85,
  "label": "Likely True",
  "bias": "Left-Center",
  "explanation": {
    "summary": "This article received a high trust score because it uses balanced language...",
    "generated_by": "gemini"
  },
  "flagged_snippets": [
    {
      "text": "This shocking discovery will change everything you know",
      "type": "MISINFORMATION",
      "index": [120, 176],
      "reason": "Sensationalist claim without verifiable evidence",
      "confidence": 0.92
    }
  ],
  "fact_checked_claims": [
    {
      "claim": "The economy grew by 3% last quarter",
      "status": "Verified",
      "explanation": "Official data confirms this figure"
    }
  ]
}
```

**Example cURL:**
```bash
curl -X POST "http://localhost:8000/predict" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Scientists have made a groundbreaking discovery in renewable energy...",
    "title": "New Solar Technology Breakthrough"
  }'
```

**Example Python:**
```python
import requests

response = requests.post(
    "http://localhost:8000/predict",
    json={
        "text": "Your article text here...",
        "title": "Article Title"
    }
)

result = response.json()
print(f"Trust Score: {result['trust_score']}")
print(f"Label: {result['label']}")
print(f"Bias: {result['bias']}")
```

### GET /health

Check service health and model status.

**Response:**
```json
{
  "status": "healthy",
  "message": "Service is running",
  "model_loaded": true
}
```

### GET /model-info

Get information about the loaded model.

**Response:**
```json
{
  "model_type": "PassiveAggressiveClassifier with TF-IDF",
  "features": "TF-IDF with unigrams, bigrams, and trigrams",
  "max_features": 10000,
  "training_dataset": "Misinformation Fake News Text Dataset (79k samples)",
  "bias_detection": "Keyword-based political bias analysis",
  "supported_languages": ["English"]
}
```

## Docker Deployment

### Build the Image

```bash
# From the ml-core directory
docker build -t ml-core:latest .
```

### Run the Container

```bash
# Run with model volume mounted
docker run -d \
  -p 8000:8000 \
  -v $(pwd)/models:/app/models \
  --name ml-core \
  ml-core:latest

# Check logs
docker logs -f ml-core

# Stop container
docker stop ml-core
```

### Train Model in Docker

```bash
# Option 1: Train before building (recommended)
python src/training.py
docker build -t ml-core:latest .

# Option 2: Train inside container
docker run -it \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/models:/app/models \
  ml-core:latest \
  python src/training.py
```

## DigitalOcean Deployment

### Prerequisites

1. DigitalOcean account
2. Docker registry (DigitalOcean Container Registry or Docker Hub)
3. Trained model file

### Deployment Steps

#### 1. Push to Container Registry

```bash
# DigitalOcean Container Registry
doctl registry login
docker tag ml-core:latest registry.digitalocean.com/your-registry/ml-core:latest
docker push registry.digitalocean.com/your-registry/ml-core:latest

# Or Docker Hub
docker tag ml-core:latest yourusername/ml-core:latest
docker push yourusername/ml-core:latest
```

#### 2. Deploy to DigitalOcean App Platform

```bash
# Create app.yaml
cat > app.yaml << EOF
name: ml-core
services:
- name: api
  image:
    registry_type: DOCR
    repository: ml-core
    tag: latest
  http_port: 8000
  health_check:
    http_path: /health
  instance_count: 1
  instance_size_slug: basic-xs
  routes:
  - path: /
EOF

# Deploy
doctl apps create --spec app.yaml
```

#### 3. Deploy to DigitalOcean Droplet

```bash
# SSH into droplet
ssh root@your-droplet-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Pull and run
docker pull registry.digitalocean.com/your-registry/ml-core:latest
docker run -d -p 8000:8000 \
  --restart unless-stopped \
  --name ml-core \
  registry.digitalocean.com/your-registry/ml-core:latest

# Setup reverse proxy (nginx)
apt install nginx
# Configure nginx to proxy port 80 to 8000
```

### Environment Variables

Create a `.env` file for configuration:

```bash
# Service Configuration
PORT=8000
WORKERS=4
LOG_LEVEL=info

# Model Configuration
MODEL_PATH=models/misinfo_model.pkl

# Gemini (optional, for explanations and deep-dive fact-checking)
GEMINI_API_KEY=your_gemini_api_key

# CORS Origins (comma-separated)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

Load in Docker:
```bash
docker run -d -p 8000:8000 --env-file .env ml-core:latest
```

## Model Performance

Expected performance on the test set:

- **Accuracy**: ~93-95%
- **F1-Score**: ~93-94%
- **Inference Time**: <100ms per article
- **Model Size**: ~5-10 MB
- **Memory Usage**: ~200-300 MB

## Monitoring and Logging

### View Logs

```bash
# Docker
docker logs -f ml-core

# Production (with systemd)
journalctl -u ml-core -f
```

### Health Monitoring

Set up monitoring with:
- **DigitalOcean Monitoring**: Built-in metrics
- **Uptime Robot**: External health checks
- **Prometheus + Grafana**: Advanced metrics

## Troubleshooting

### Model Not Loaded Error

```
Error: Model not found at models/misinfo_model.pkl
```

**Solution:** Train the model first:
```bash
python src/training.py
```

### Import Errors

```
ImportError: No module named 'sklearn'
```

**Solution:** Install dependencies:
```bash
pip install -r requirements.txt
```

### Low Accuracy

If model accuracy is below 85%:
1. Verify dataset quality
2. Check for data imbalance
3. Increase `max_features` in training.py
4. Add more training data

### Memory Issues

If running out of memory:
1. Reduce `max_features` to 5000
2. Use smaller `instance_size_slug` on DigitalOcean
3. Implement batch processing for large requests

## Development

### Running Tests

```bash
# Install test dependencies
pip install pytest pytest-cov

# Run tests
pytest tests/ -v

# With coverage
pytest tests/ --cov=src --cov-report=html
```

### Code Quality

```bash
# Format code
black src/

# Lint
flake8 src/
pylint src/

# Type checking
mypy src/
```

## API Integration

### Next.js Frontend Example

```typescript
// lib/api.ts
export async function analyzearticle(text: string, title?: string) {
  const response = await fetch('http://localhost:8000/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, title }),
  });
  
  if (!response.ok) throw new Error('Analysis failed');
  return response.json();
}

// Usage in component
const result = await analyzeArticle(articleText, articleTitle);
console.log(`Trust Score: ${result.trust_score}`);
```

## Performance Optimization

### Production Recommendations

1. **Use multiple workers**: `--workers 4` (2 x CPU cores)
2. **Enable compression**: Use nginx/gzip for responses
3. **Cache model**: Load model once at startup (already implemented)
4. **Rate limiting**: Implement rate limiting for abuse prevention
5. **CDN**: Use CloudFlare or similar for DDoS protection

### Scaling

- **Horizontal**: Deploy multiple instances behind a load balancer
- **Vertical**: Upgrade droplet/instance size
- **Database**: Add Redis for caching frequent predictions
- **Queue**: Use Celery + Redis for async processing

## Security

### Best Practices

1. **HTTPS only**: Always use TLS in production
2. **API Keys**: Implement authentication (JWT/API keys)
3. **Rate Limiting**: Prevent abuse (fastapi-limiter)
4. **Input Validation**: Already implemented via Pydantic
5. **Non-root User**: Container runs as `appuser` (UID 1000)

### Example: Add API Key Authentication

```python
# In main.py
from fastapi.security import APIKeyHeader

API_KEY = os.getenv("API_KEY", "your-secret-key")
api_key_header = APIKeyHeader(name="X-API-Key")

async def verify_api_key(api_key: str = Security(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key")
    return api_key

@app.post("/predict", dependencies=[Depends(verify_api_key)])
async def predict(request: PredictRequest):
    # ... implementation
```

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/yourusername/cruzhacks26/issues)
- Email: support@yourdomain.com

## Acknowledgments

- Dataset: [Kaggle Misinformation Dataset](https://www.kaggle.com/datasets/stevenpeutz/misinformation-fake-news-text-dataset-79k)
- Framework: [FastAPI](https://fastapi.tiangolo.com/)
- ML Library: [Scikit-learn](https://scikit-learn.org/)
