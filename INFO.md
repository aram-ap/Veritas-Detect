Here is the `INFO.md` file. You can save this in the root of your repository. It is structured to provide immediate, high-density context to any future AI agent or developer working on this project.

```markdown
# Project Veritas: Misinformation Detection Platform - Master Reference

## 1. Project Overview
**Veritas** is a multi-platform system designed to identify misinformation, political bias, and factual errors in web articles.
* **Core Function:** Users view a website, and a Chrome Extension analyzes the text in real-time.
* **Deep Dive:** Users can request a detailed analysis using LLMs (Gemini) to cross-reference claims with live search data.
* **Architecture Strategy:** Hybrid.
    * **Frontend/Gateway:** Hosted on Vercel (Serverless).
    * **Compute/ML:** Hosted on DigitalOcean (Persistent Server).

## 2. Technical Architecture

### High-Level Data Flow
1.  **Chrome Extension:** Scrapes `<article>` text from the DOM.
2.  **Auth Layer:** Extension includes Auth0 session cookies in the request.
3.  **Gateway (Next.js):** Receives request at `/api/analyze`. Verifies Auth0 session.
4.  **Proxy:** Next.js proxies valid requests to the DigitalOcean Python Backend (hidden from client).
5.  **Inference (Python):** Backend cleans text, vectorizes, runs ML model, returns Score/Bias/Highlights.
6.  **Deep Dive (Optional):** Next.js calls Google Gemini API for detailed reasoning and source checking.

### The Stack
| Component | Technology | Hosting |
| :--- | :--- | :--- |
| **Extension** | React, Vite, Manifest V3 | Chrome Web Store |
| **Web Dashboard** | Next.js 14+ (App Router), Tailwind | Vercel |
| **Auth** | Auth0 (Shared Session) | Auth0 Cloud |
| **ML Backend** | Python 3.10+, FastAPI, Docker | DigitalOcean (App Platform/Droplet) |
| **Database** | Vercel Postgres or Supabase | Vercel/External |
| **AI/LLM** | Google Gemini (Deep Dive), Scikit-Learn (Quick Score) | -- |

## 3. Monorepo Structure

```text
/veritas-platform (Root)
├── /apps
│   ├── /web                  # Next.js Gateway & Dashboard
│   │   ├── /app/api/analyze  # Proxies to Python Backend
│   │   └── /app/api/deep-dive# Calls Google Gemini
│   │
│   └── /extension            # Chrome Extension (React)
│       ├── manifest.json     # Permissions: sidePanel, activeTab, scripting, cookies
│       └── /src/sidepanel    # Main UI
│
├── /services
│   └── /ml-core              # Python FastAPI Service
│       ├── /data             # Training data (gitignored)
│       ├── /models           # Serialized models (.pkl)
│       ├── main.py           # API Entry
│       ├── training.py       # Model training script
│       └── Dockerfile        # DigitalOcean deployment config

```

## 4. Machine Learning & Backend Specifications

### The Dataset

* **Source:** [Kaggle: Misinformation Fake News Text Dataset (79k)](https://www.kaggle.com/datasets/stevenpeutz/misinformation-fake-news-text-dataset-79k)
* **Labels:** Fake vs. True.

### The Algorithm (Python Service)

* **Framework:** FastAPI.
* **Preprocessing:** HTML stripping, tokenization.
* **Model:** `TfidfVectorizer` + `PassiveAggressiveClassifier` (or Logistic Regression).
* **Bias Detection:** Pre-trained Transformer (DistilBERT) or Keyword Heuristic.
* **Highlighting Logic:** Reverse-mapping TF-IDF features to original text indices to identify "suspicious snippets."

### API Schema (Python Service)

**POST** `/predict`

* **Input:** `{ "text": "...", "title": "..." }`
* **Output:**
```json
{
  "trust_score": 85,
  "bias": "Left-Center",
  "flagged_snippets": [
    { "text": "...", "indices": [10, 50], "reason": "..." }
  ]
}

```



## 5. Third-Party Integrations

* **Auth0:**
* Used for user management.
* **Crucial:** The Chrome Extension must utilize `host_permissions` to access the Next.js domain cookies to share the login state.


* **Google Gemini:**
* Accessed via Vercel AI SDK on the Next.js side.
* **System Prompt:** "You are a fact-checker. Analyze the text, identify errors, and provide search queries to verify corrections."



## 6. Implementation Checklist (Current Status)

### Phase 1: Skeleton (Priority)

* [ ] Initialize Monorepo.
* [ ] Create `manifest.json`.
* [ ] Setup Next.js + Auth0.

### Phase 2: The Brain (Python)

* [ ] Write `training.py` to ingest Kaggle dataset.
* [ ] Build FastAPI `/predict` endpoint.
* [ ] Dockerize and deploy to DigitalOcean.

### Phase 3: The Deep Dive

* [ ] Implement Gemini streaming in Next.js.

### Phase 4: The Client

* [ ] Build React Side Panel UI (Score Gauge).
* [ ] Write DOM Content Script (Highlighting).

## 7. Guidelines for AI Agents

1. **No Direct Access:** The Extension never talks to the Python Backend directly. Always route through Next.js.
2. **Environment Variables:** All secrets (Auth0 keys, Gemini API Key, DO Service URL) must be in `.env`.
3. **Strict Typing:** Use TypeScript for JS/React/Next.js files. Use Type Hints for Python.
4. **Performance:** The Python backend is persistent (DigitalOcean), so models can be loaded into memory on startup (global variables) rather than per-request.

```

```
