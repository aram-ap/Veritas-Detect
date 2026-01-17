# Fact-Checking Setup Guide

## Overview

The ML backend now includes **external fact-checking** capabilities that verify claims extracted from analyzed content using real-world fact-checking databases and APIs.

## Architecture

```
Article → Gemini Analysis → Extract Claims → Fact-Check APIs → Enriched Results
                ↓                              ↓
          Flagged Content            Google Fact Check API
          Bias Detection             SerpAPI (optional)
```

## How It Works

1. **Gemini extracts verifiable claims** from the article text
   - Example: "The unemployment rate dropped to 3.5% in December 2024"
   - Only factual, verifiable statements are extracted

2. **Claims are sent to external fact-checking APIs**
   - **Google Fact Check Tools API** (free tier available)
   - **SerpAPI** (optional, paid) for recent news verification

3. **Results are merged** and returned with:
   - Original trust score and bias
   - Flagged suspicious snippets
   - **Fact-checked claims with verification status**

## Setup Instructions

### 1. Get Google Fact Check API Key (Free)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Fact Check Tools API**:
   - Search for "Fact Check Tools API" in the API Library
   - Click "Enable"
4. Create credentials:
   - Go to **APIs & Services → Credentials**
   - Click **Create Credentials → API Key**
   - Copy your API key
5. (Optional) Restrict your API key:
   - Click on the key you just created
   - Under "API restrictions", select "Restrict key"
   - Choose "Fact Check Tools API"
   - Save

### 2. (Optional) Get SerpAPI Key

For enhanced fact-checking of recent events:

1. Go to [SerpAPI](https://serpapi.com/)
2. Sign up for a free account (100 searches/month free)
3. Copy your API key from the dashboard

### 3. Configure Environment Variables

Update your `.env` file in `services/ml-core/`:

```bash
# Required: Gemini API Key (for AI analysis)
GEMINI_API_KEY=your-gemini-api-key-here

# Optional: Google Fact Check API (highly recommended)
GOOGLE_FACT_CHECK_API_KEY=your-google-fact-check-api-key-here

# Optional: SerpAPI (for recent events)
SERP_API_KEY=your-serp-api-key-here
```

### 4. Restart the Backend

```bash
cd services/ml-core
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

## API Response Format

The `/predict` endpoint now returns fact-checked claims:

```json
{
  "trust_score": 75,
  "label": "Suspicious",
  "bias": "Left-Center",
  "explanation": {
    "summary": "Mixed credibility with some verifiable facts...",
    "generated_by": "gemini"
  },
  "flagged_snippets": [...],
  "fact_checked_claims": [
    {
      "claim": "The unemployment rate dropped to 3.5% in December 2024",
      "status": "Verified",
      "explanation": "Confirmed by official Bureau of Labor Statistics data",
      "sources": ["https://factcheck.org/..."],
      "confidence": 0.9
    },
    {
      "claim": "President X signed executive order Y",
      "status": "False",
      "explanation": "No such executive order exists in public records",
      "sources": ["https://snopes.com/..."],
      "confidence": 0.8
    }
  ],
  "metadata": {
    "fact_checks_performed": 2,
    "model": "gemini-2.0-flash-exp"
  }
}
```

## Fact-Check Status Values

| Status | Meaning |
|--------|---------|
| `Verified` | Claim confirmed by credible sources |
| `False` | Claim debunked by fact-checkers |
| `Misleading` | Partially true but missing context |
| `Unverified` | No fact-check data available |
| `Mixed` | Contains both true and false elements |

## Limitations

1. **Rate Limits**:
   - Google Fact Check API: Free tier has generous limits
   - SerpAPI: 100 searches/month on free tier

2. **Coverage**:
   - Fact-checking databases may not cover all claims
   - Very recent events might not be indexed yet

3. **Language**:
   - Currently supports English only

## Cost Considerations

- **Gemini API**: Pay-per-token (very affordable for text analysis)
- **Google Fact Check API**: Free tier available, no credit card required
- **SerpAPI**: Free tier (100/month), paid plans start at $50/month

## Troubleshooting

### No fact-checked claims returned

**Possible causes:**
- No API key configured → Check your `.env` file
- Article contains no verifiable claims → Gemini didn't extract factual statements
- Claims not in fact-check database → Normal for niche topics

**Check logs:**
```bash
# Backend logs will show:
# "Found X verifiable claims, checking with external APIs..."
# "Completed fact-checking: X claims verified"
```

### "Unverified" status for all claims

This means:
- Claims are valid but not in fact-checking databases
- Try adding SerpAPI for broader coverage
- Recent events may not be indexed yet

### API errors

Check your API key validity:
```bash
curl "https://factchecktools.googleapis.com/v1alpha1/claims:search?key=YOUR_KEY&query=covid"
```

## Development & Testing

### Test the fact-checker directly:

```python
from src.fact_checker import FactCheckService

fact_checker = FactCheckService()
claims = ["The Earth is round", "The Moon is made of cheese"]
results = fact_checker.check_claims(claims)

for result in results:
    print(f"{result.claim}: {result.status}")
```

### Disable fact-checking temporarily:

Simply don't set the `GOOGLE_FACT_CHECK_API_KEY` environment variable. The system will gracefully degrade to AI-only analysis.

## Future Enhancements

Potential additions:
- [ ] Support for multiple languages
- [ ] Integration with more fact-checking APIs
- [ ] Custom fact-check database for domain-specific verification
- [ ] Confidence-weighted scoring (adjust trust score based on fact-checks)

## Support

For issues or questions:
1. Check the backend logs for errors
2. Verify API keys are valid
3. Ensure APIs are enabled in Google Cloud Console
4. Check rate limits haven't been exceeded
