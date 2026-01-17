# Enhanced Claim Validation System

## Overview

The AI extension now includes an **Enhanced Claim Validation System** that prevents the AI from making unverified negative assertions. This system ensures that any claim about something being false, fabricated, or non-existent is backed by external sources before being presented to users.

## Problem Solved

Previously, the AI could flag content as "doesn't exist" or "is false" based solely on its training data, which might be:
- Outdated (knowledge cutoff)
- Incomplete (missing recent events)
- Wrong (hallucinations or errors)

This led to false positives where legitimate content was incorrectly flagged.

## Solution

The new system implements a **three-layer verification approach**:

### 1. Prompt-Level Instructions (gemini_explainer.py)

The AI is explicitly instructed to:
- Search Google before making negative claims
- Include sources for any claim about falsity or non-existence
- Use softer language ("could not be verified") when sources aren't found
- Never claim something doesn't exist without verification

### 2. Automated Claim Validation (claim_validator.py)

After the AI generates its analysis, a validation layer:
- Scans all flagged snippets for negative assertions
- Detects patterns like "doesn't exist", "is false", "never happened"
- Automatically verifies these claims via Google Fact Check API
- Enriches verified claims with source URLs
- **Filters out** unverified negative claims

### 3. Fact-Checking Integration (fact_checker.py)

External verification through:
- Google Fact Check Tools API (primary)
- SerpAPI for recent news (fallback)
- Credible source validation

## How It Works

### Detection Patterns

The validator detects negative assertions using regex patterns:

**Non-Existence Claims:**
- "does not exist" / "doesn't exist"
- "never existed"
- "is not real" / "are not real"
- "is fake" / "fabricated" / "made up"
- "no evidence" / "zero evidence"

**Falsity Claims:**
- "is false" / "is incorrect" / "is wrong"
- "has been debunked"
- "never happened" / "didn't occur"
- "not true" / "not accurate"

**Denial Claims:**
- "no proof" / "no evidence" / "no data"
- "cannot be verified"
- "not documented" / "not confirmed"

### Validation Flow

```
AI Generates Analysis
       ↓
Flagged Snippet: "This person doesn't exist"
       ↓
Claim Validator Detects Negative Assertion
       ↓
Extract Claim → "This person doesn't exist"
       ↓
Check Google Fact Check API
       ↓
   ┌─────────────────┬─────────────────┐
   │                 │                 │
Sources Found    No Sources       Error
   │                 │                 │
   ↓                 ↓                 ↓
Add Sources    Filter Out       Filter Out
to Snippet       Snippet          Snippet
   │
   ↓
Return Enriched Result
```

### Example

**Before Validation:**
```json
{
  "flagged_snippets": [
    {
      "text": "John Doe",
      "type": "Misinformation",
      "reason": "This person doesn't exist in any records",
      "severity": "high",
      "sources": []
    }
  ]
}
```

**After Validation:**

If verified:
```json
{
  "flagged_snippets": [
    {
      "text": "John Doe",
      "type": "Misinformation",
      "reason": "This person doesn't exist in any records",
      "severity": "high",
      "sources": [
        {
          "url": "https://factcheck.org/john-doe-verification",
          "title": "Fact-check source",
          "snippet": "External verification"
        }
      ]
    }
  ],
  "metadata": {
    "snippets_validated": 1,
    "snippets_after_validation": 1,
    "snippets_filtered": 0
  }
}
```

If NOT verified:
```json
{
  "flagged_snippets": [],
  "metadata": {
    "snippets_validated": 1,
    "snippets_after_validation": 0,
    "snippets_filtered": 1
  }
}
```

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Required for fact-checking
GOOGLE_FACT_CHECK_API_KEY=your_google_api_key_here

# Optional - for enhanced recent news verification
SERP_API_KEY=your_serpapi_key_here

# Optional - Control validation behavior (default: true)
REQUIRE_SOURCES_FOR_NEGATIVE_CLAIMS=true
```

### Configuration Options

**REQUIRE_SOURCES_FOR_NEGATIVE_CLAIMS** (default: `true`)
- `true`: Filter out all negative claims without sources (recommended)
- `false`: Keep unverified claims but mark them with a warning

## API Setup

### Google Fact Check Tools API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the "Fact Check Tools API"
4. Create an API key:
   - Navigate to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy the API key

5. Add to `.env`:
   ```bash
   GOOGLE_FACT_CHECK_API_KEY=AIza...your_key_here
   ```

**Note:** This API is **free** with generous quotas (10,000 requests/day).

### SerpAPI (Optional)

For enhanced verification of very recent events:

1. Sign up at [SerpAPI](https://serpapi.com/)
2. Get your API key from the dashboard
3. Add to `.env`:
   ```bash
   SERP_API_KEY=your_serpapi_key_here
   ```

**Note:** Free tier includes 100 searches/month.

## Usage

The validation happens automatically in the inference pipeline. No code changes needed.

### In Your Application

When calling the analysis endpoint:

```python
from inference import predict_full_analysis

result = predict_full_analysis(
    text=article_text,
    title=article_title,
    url=article_url
)

# Result will have validated snippets with sources
for snippet in result['flagged_snippets']:
    print(f"Text: {snippet['text']}")
    print(f"Reason: {snippet['reason']}")

    # Sources are automatically added for negative claims
    if snippet.get('sources'):
        print("Verified by:")
        for source in snippet['sources']:
            print(f"  - {source['url']}")
```

### Streaming API

The streaming endpoint also includes validation:

```python
async for event in predict_full_analysis_streaming(text, title, url):
    # Progress updates include validation step
    if event['type'] == 'status' and 'Validating' in event['message']:
        print("Validating claims for sources...")
```

## Validation Metadata

The response includes metadata about the validation process:

```json
{
  "metadata": {
    "snippets_validated": 5,
    "snippets_after_validation": 3,
    "snippets_filtered": 2,
    "fact_checks_performed": 4
  }
}
```

**Fields:**
- `snippets_validated`: Total snippets checked
- `snippets_after_validation`: Snippets that passed validation
- `snippets_filtered`: Snippets removed due to unverified negative claims
- `fact_checks_performed`: Number of external fact-check queries made

## Benefits

1. **No False Claims**: AI cannot assert something is false without proof
2. **Source Transparency**: All negative claims backed by verifiable sources
3. **Up-to-Date**: Uses current fact-check databases, not just training data
4. **User Trust**: Users can verify claims themselves via provided sources
5. **Reduced Liability**: Extension doesn't make unsubstantiated claims

## Best Practices

### For Developers

1. **Always check metadata**: Monitor `snippets_filtered` to see if claims are being rejected
2. **Review logs**: Check for validation warnings in your logs
3. **Set up API keys**: Ensure Fact Check API is configured for production
4. **Monitor quotas**: Track API usage to stay within limits

### For Users

1. **Check sources**: Always review provided source URLs
2. **Understand confidence**: Lower confidence scores = less certain claims
3. **Report issues**: If legitimate content is filtered, report it for review

## Troubleshooting

### Issue: Too many snippets are being filtered

**Solution:**
- Set `REQUIRE_SOURCES_FOR_NEGATIVE_CLAIMS=false` to keep unverified claims with warnings
- Check if Google Fact Check API key is configured correctly
- Review logs for API errors

### Issue: Slow analysis

**Solution:**
- Validation adds 1-3 seconds for API calls
- Consider caching results (already implemented)
- Use streaming API for better UX during validation

### Issue: No sources found for legitimate claims

**Solution:**
- Google Fact Check API may not have coverage for all topics
- Add SerpAPI key for broader coverage
- Recent/niche events may not have fact-check articles yet
- System will use softer language in these cases

## Code References

| File | Purpose |
|------|---------|
| `claim_validator.py` | Main validation logic and pattern detection |
| `gemini_explainer.py` | Updated AI prompts with source requirements |
| `inference.py` | Integration into analysis pipeline |
| `fact_checker.py` | External API verification |

## Future Enhancements

Potential improvements:
- Add more fact-check sources (PolitiFact, Snopes direct APIs)
- Implement claim caching to avoid re-checking common claims
- Add confidence scoring for pattern-detected negative assertions
- Support for custom credible source lists
- Multi-language fact-checking support

## Testing

To test the validation system:

1. **Test with a known false claim:**
   ```python
   text = "The moon landing was faked in 1969."
   result = predict_full_analysis(text)
   # Should be flagged with sources from fact-checkers
   ```

2. **Test with a non-existent person:**
   ```python
   text = "John Fakeperson invented the internet in 1823."
   result = predict_full_analysis(text)
   # Should be filtered if no verification found, or flagged with sources
   ```

3. **Test with legitimate recent content:**
   ```python
   text = "The new AI model was released in January 2026."
   result = predict_full_analysis(text)
   # Should NOT be flagged as false due to date context
   ```

## Conclusion

The Enhanced Claim Validation System ensures your AI extension makes responsible, verifiable claims backed by external sources, significantly improving trust and accuracy.
