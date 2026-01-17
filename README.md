# Veritas: Misinformation Detection Platform

A hybrid architecture platform for identifying misinformation and bias in web content.

## Architecture

- **Extension**: Chrome Extension (Manifest V3, React + Vite) - `apps/extension`
- **Web**: Next.js Dashboard & API Gateway - `apps/web`
- **ML Core**: Python FastAPI Service - `services/ml-core`

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- Docker (optional, for ML service)

### 1. Setup ML Service

```bash
cd services/ml-core
pip install -r requirements.txt
uvicorn main:app --reload
# Service runs on http://localhost:8000
```

### 2. Setup Web Platform

```bash
cd apps/web
cp .env.example .env.local
# Fill in Auth0 credentials in .env.local
npm install
npm run dev
# Web runs on http://localhost:3000
```

### 3. Setup Extension

1. Build the extension:
   ```bash
   cd apps/extension
   npm install
   npm run build
   ```
2. Open Chrome -> Extensions (`chrome://extensions/`)
3. Enable "Developer mode"
4. Click "Load unpacked" and select `apps/extension/dist`

## Development

- The Extension communicates with the Web Platform (`localhost:3000`) for authentication and analysis proxying.
- The Web Platform proxies requests to the ML Service (`localhost:8000`).

## Environment Variables

See `apps/web/.env.example` for required keys.