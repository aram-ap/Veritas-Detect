# Changelog - Gemini Integration & UI Improvements

## Summary of Changes

This update significantly enhances the Veritas misinformation detection system by integrating Google Gemini AI for more intelligent content analysis and improving the user interface with interactive flagged content displays.

## Key Improvements

### 1. Gemini AI Integration (Always Enabled)
- **Removed toggle**: Gemini is now always enabled for all scans, no longer an optional "Deep Dive" feature
- **Sentence-level flagging**: Gemini now analyzes articles and flags complete sentences/phrases instead of single words
- **Smart categorization**: Flagged content is categorized as:
  - **MISINFORMATION**: False or inaccurate information shared without intent to deceive
  - **DISINFORMATION**: Deliberately false information intended to mislead
  - **PROPAGANDA**: Biased or misleading information used to promote a particular viewpoint
- **AI-powered explanations**: Gemini generates comprehensive explanations for trust scores
- **Automatic fact-checking**: Key claims are identified and verified with each scan

### 2. Interactive Flagged Content UI
- **Expandable boxes**: Click on any flagged item to see detailed explanation
- **Color-coded by type**:
  - Amber: Misinformation
  - Red: Disinformation
  - Purple: Propaganda
- **Confidence indicators**: Shows confidence percentage for each flag
- **Full sentences**: Displays meaningful context instead of single words

### 3. Improved Error Handling
- **Better page validation**: Clear error messages for unsupported pages
- **Specific guidance**: Tells users exactly what types of pages can be analyzed
- **Content length validation**: Ensures sufficient text is available for analysis
- **Auto-retry logic**: Automatically injects content script if needed

### 4. Backend Improvements
- **Fallback system**: If Gemini is unavailable, falls back to ML model-based flagging
- **Cached predictors**: ML models and Gemini clients are cached to avoid reloading
- **Enhanced API responses**: All responses now include type, reason, and confidence for flagged items

## Files Modified

### Frontend (Extension)
- `apps/extension/src/App.tsx`
  - Removed deep_dive toggle
  - Added expandable flagged content UI
  - Improved error handling with specific messages
  - Added color-coded flag type styling

### Backend (ML Service)
- `services/ml-core/src/gemini_explainer.py`
  - Added `flag_suspicious_sentences()` method for sentence-level flagging
  - Enhanced prompts for better categorization
  - Added `_parse_flagged_items()` parser

- `services/ml-core/src/inference.py`
  - Updated `predict_full_analysis()` to use Gemini by default
  - Added fallback to ML model if Gemini unavailable
  - Integrated sentence flagging and fact-checking

- `services/ml-core/src/main.py`
  - Updated `FlaggedSnippet` model to include `type` field
  - Removed `deep_dive` parameter (now always enabled)
  - Updated API documentation examples

### API
- `apps/web/src/app/api/analyze/route.ts`
  - Removed deep_dive parameter
  - Updated to handle new flag types

### Documentation
- `services/ml-core/README.md`
  - Updated feature list
  - Removed deep_dive from examples
  - Added type field to snippet examples

## Testing the Changes

### Prerequisites
1. Ensure Gemini API key is set in `.env`:
   ```bash
   GEMINI_API_KEY=your_api_key_here
   ```

2. Restart the ML service:
   ```bash
   cd services/ml-core
   ./start.sh
   ```

3. Rebuild the extension:
   ```bash
   cd apps/extension
   npm run build
   ```

4. Reload the extension in Chrome

### What to Test

1. **Scan Various Pages**:
   - News articles (should work)
   - Blog posts (should work)
   - Chrome system pages (should show clear error)
   - Pages with minimal text (should show content length error)

2. **Check Flagged Content**:
   - Should see full sentences, not single words
   - Each item should have a type (Misinformation/Disinformation/Propaganda)
   - Click to expand should show detailed explanation
   - Color-coding should match the type

3. **Verify Gemini Features**:
   - "Why This Score" section should have AI-generated explanation
   - "Fact-Checked Claims" should appear automatically (no toggle needed)
   - Flagged items should be contextually relevant sentences

4. **Test Error Scenarios**:
   - Try scanning chrome://extensions (should show friendly error)
   - Try scanning a page with very little text (should show content error)
   - Scan works on localhost, news sites, blogs, etc.

## API Changes

### Request (Simplified)
```json
{
  "text": "Article text...",
  "title": "Article title"
}
```
Note: Removed `deep_dive` parameter

### Response (Enhanced)
```json
{
  "trust_score": 75,
  "label": "Likely True",
  "bias": "Center",
  "explanation": {
    "summary": "AI-generated explanation...",
    "generated_by": "gemini"
  },
  "flagged_snippets": [
    {
      "text": "Full sentence that was flagged",
      "type": "MISINFORMATION",
      "reason": "Why this was flagged",
      "confidence": 0.92
    }
  ],
  "fact_checked_claims": [
    {
      "claim": "Specific claim from article",
      "status": "Verified",
      "explanation": "How it was verified"
    }
  ]
}
```

## Configuration

Ensure your `.env` file includes:
```env
GEMINI_API_KEY=your_api_key_here
```

If Gemini is not configured, the system will:
1. Log a warning
2. Fall back to ML model-based flagging
3. Generate rule-based explanations
4. Skip fact-checking

## Performance Notes

- **Gemini integration adds ~2-4 seconds** to analysis time
- Results are more accurate and contextually relevant
- Caching reduces overhead on subsequent requests
- Fallback ensures service continues if Gemini is unavailable

## Future Enhancements

Potential improvements to consider:
- Streaming responses for real-time updates
- User feedback system for flagged items
- Confidence threshold controls
- Custom flag type definitions
- Export analysis reports
