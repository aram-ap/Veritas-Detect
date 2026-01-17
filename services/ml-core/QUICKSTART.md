# ML Core - Quick Start Guide

## 1. Setup (First Time Only)

```bash
cd services/ml-core

# Run automated setup
./setup.sh

# Or manual setup:
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 2. Download Dataset

1. Visit: https://www.kaggle.com/datasets/stevenpeutz/misinformation-fake-news-text-dataset-79k
2. Download the dataset (it comes as two CSV files)
3. Place them in the `data/` folder:
   - `data/DataSet_Misinfo_FAKE.csv`
   - `data/DataSet_Misinfo_TRUE.csv`

## 3. Prepare Dataset

Combine the two CSV files into one:

```bash
python scripts/prepare_dataset.py
```

This creates `data/dataset.csv` with proper labels (0=Fake, 1=True)

## 4. Train Model

```bash
python src/training.py
```

Expected: ~93-95% accuracy, creates `models/misinfo_model.pkl`

## 5. Run Service

```bash
# Development (auto-reload)
uvicorn src.main:app --reload

# Production
uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 4

# Docker
docker-compose up

# Docker (detached)
docker-compose up -d
```

## 6. Test API

**Open docs:** http://localhost:8000/docs

**Health check:**
```bash
curl http://localhost:8000/health
```

**Analyze text:**
```bash
curl -X POST "http://localhost:8000/predict" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Breaking news: Scientists discover new renewable energy source that could power entire cities.",
    "title": "Revolutionary Energy Discovery"
  }'
```

**Expected response:**
```json
{
  "trust_score": 85,
  "label": "Likely True",
  "bias": "Center",
  "flagged_snippets": []
}
```

## 7. Deploy to DigitalOcean

```bash
# Build and push
docker build -t ml-core .
docker tag ml-core registry.digitalocean.com/your-registry/ml-core
docker push registry.digitalocean.com/your-registry/ml-core

# Deploy via App Platform or Droplet (see README.md)
```

## Common Commands

```bash
# Activate venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Prepare dataset (combine FAKE + TRUE)
python scripts/prepare_dataset.py

# Train model
python src/training.py

# Run dev server
uvicorn src.main:app --reload

# Run production
uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 4

# Docker build
docker build -t ml-core .

# Docker run
docker run -p 8000:8000 -v $(pwd)/models:/app/models ml-core

# Docker Compose
docker-compose up -d
docker-compose logs -f
docker-compose down
```

## File Structure

```
services/ml-core/
├── src/
│   ├── main.py              # FastAPI app
│   ├── training.py          # Model training
│   ├── inference.py         # Predictions
│   └── preprocessing.py     # Text cleaning
├── scripts/
│   └── prepare_dataset.py   # Combine datasets
├── data/
│   ├── DataSet_Misinfo_FAKE.csv  # Fake news
│   ├── DataSet_Misinfo_TRUE.csv  # Real news
│   └── dataset.csv               # Combined (generated)
├── models/
│   └── misinfo_model.pkl    # Trained model
├── Dockerfile               # Container config
├── docker-compose.yml       # Docker Compose
├── requirements.txt         # Dependencies
├── setup.sh                 # Automated setup
└── README.md               # Full documentation
```

## API Endpoints

- `GET /` - API info
- `GET /health` - Health check
- `GET /docs` - Interactive API docs
- `POST /predict` - Analyze article
- `GET /model-info` - Model details

## Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit as needed:
- `PORT=8000`
- `WORKERS=4`
- `CORS_ORIGINS=http://localhost:3000`

## Troubleshooting

**Dataset files not found:**
```bash
# Download from Kaggle and place in data/ folder
# Then run:
python scripts/prepare_dataset.py
```

**Model not found:**
```bash
# First prepare dataset, then train:
python scripts/prepare_dataset.py
python src/training.py
```

**Import errors:**
```bash
pip install -r requirements.txt
```

**Permission denied (setup.sh):**
```bash
chmod +x setup.sh
```

**Port already in use:**
```bash
# Use different port
uvicorn src.main:app --port 8001
```

## Next Steps

1. ✅ Train model with your dataset
2. ✅ Test API locally
3. ✅ Integrate with Next.js frontend
4. ✅ Deploy to DigitalOcean
5. ✅ Set up monitoring
6. ✅ Configure HTTPS/SSL

For detailed instructions, see [README.md](README.md)
