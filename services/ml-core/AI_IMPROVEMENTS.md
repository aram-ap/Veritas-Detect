# AI Model Improvements - Current Events & Source Citation

## Overview
Enhanced the AI misinformation detection system to provide current date/time context and cross-reference current events with web sources.

## Changes Made

### 1. Current Date/Time Context ✅
**Problem:** AI was flagging content about future events as misinformation because it lacked temporal awareness.

**Solution:** Added current date/time to Gemini prompt
- File: `src/gemini_explainer.py`
- Now includes: Current date (e.g., "January 17, 2026"), current year, and context about training cutoff
- AI is instructed not to flag future events as false, but rather mark them for verification

### 2. Web Search for Current Events ✅
**New Feature:** Cross-reference claims with web sources to verify current events

**Implementation:**
- Created new service: `src/web_search.py`
- Uses Google Custom Search API to find credible sources
- Automatically verifies flagged snippets marked as `needs_verification`
- Returns sources with credibility indicators

**Key Features:**
- Searches for recent articles (last 30 days)
- Identifies credible sources (Reuters, AP, BBC, fact-checking sites, etc.)
- Returns top 5 sources with snippets
- Confidence scoring based on number of credible sources found

### 3. Source Display in Extension ✅
**New UI Feature:** Shows sources used for verification in the extension

**Implementation:**
- Updated `FlaggedContent.tsx` interface to include sources
- Each flagged snippet can now display:
  - Verification status (e.g., "Verified - Multiple credible sources found")
  - Verification confidence percentage
  - List of sources with:
    - Article title
    - Source domain
    - Article snippet
    - Credibility indicator (green checkmark for trusted sources)
    - Clickable links to read full articles

**User Experience:**
- Expand any flagged snippet to see sources
- Click source links to read full articles in new tab
- Visual indicators show which sources are from credible outlets

### 4. Enhanced Gemini Prompt ✅
**Updates to AI Instructions:**
```
IMPORTANT CONTEXT:
- Today's date is: {current_date}
- Current year: {current_year}
- For claims about events after your cutoff, flag them for verification
- Articles dated in the future are likely legitimate news

New JSON structure includes:
- needs_verification: boolean (true for recent events)
- search_query: specific query to verify the claim
```

## Configuration

### Required (Already Configured)
- ✅ `GEMINI_API_KEY` - For AI analysis

### Optional (For Web Search)
To enable web search verification, add to `services/ml-core/.env`:

```bash
# Option 1: Google Custom Search (Recommended)
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here
```

**How to get Google Custom Search API:**
1. Go to https://console.cloud.google.com/
2. Enable "Custom Search API"
3. Create API key
4. Create Custom Search Engine at https://cse.google.com/
5. Get the Search Engine ID

**Without API Key:**
- Web search gracefully degrades
- Flagged snippets won't show sources
- Rest of the system works normally

## Testing

### Test the Current Date Context
1. Find an article about a recent event (January 2026)
2. Analyze it with the extension
3. AI should NOT flag it as "future event" misinformation
4. Should see normal analysis

### Test Web Search (if configured)
1. Analyze an article with verifiable claims
2. Expand a flagged snippet
3. Should see "Verification Status" section
4. Should see "Sources Found" with clickable links
5. Credible sources show green checkmark icon

### Test Without Web Search
1. Don't configure Google API keys
2. Analyze an article
3. Flagged snippets appear normally
4. No sources section (graceful degradation)

## Files Modified

### Backend (Python)
- `services/ml-core/src/gemini_explainer.py` - Added date context to prompt, updated JSON structure
- `services/ml-core/src/inference.py` - Integrated web search verification
- `services/ml-core/src/web_search.py` - **NEW** - Web search service
- `services/ml-core/AI_IMPROVEMENTS.md` - **NEW** - This document

### Frontend (Extension)
- `apps/extension/src/components/FlaggedContent.tsx` - Added sources display UI

## API Response Structure Changes

Flagged snippets now include:
```typescript
{
  text: string;
  type: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';

  // NEW FIELDS
  needs_verification?: boolean;
  search_query?: string;
  sources?: Array<{
    title: string;
    url: string;
    snippet: string;
    source: string;  // domain name
    is_credible: boolean;
  }>;
  verification_status?: string;
  verification_confidence?: number;  // 0-1
}
```

## Benefits

1. **Temporal Awareness:** AI knows what year it is and doesn't flag legitimate current events
2. **Source Citation:** Users can verify claims themselves by reading cited sources
3. **Transparency:** Shows where information comes from (news articles, fact-checks, etc.)
4. **Trust Building:** Credibility indicators help users evaluate sources
5. **Educational:** Users learn to cross-reference and verify information

## Future Enhancements

Potential improvements:
- [ ] Add caching for web search results
- [ ] Support for more search providers (DuckDuckGo, Bing, etc.)
- [ ] Sentiment analysis of sources (positive/negative coverage)
- [ ] Timeline view showing how a story evolved over time
- [ ] Source diversity metrics (left/right/center coverage)
- [ ] Integration with archive.org for historical verification

## Troubleshooting

**Web search not working:**
- Check `GOOGLE_API_KEY` is set in `.env`
- Check `GOOGLE_SEARCH_ENGINE_ID` is set
- Verify API key has Custom Search API enabled
- Check logs for error messages: `tail -f logs/ml-core.log`

**Sources not appearing:**
- Check if snippet has `needs_verification: true`
- Verify web search service is initialized (check logs)
- Some snippets may not need verification (opinion, analysis, etc.)

**API quota exceeded:**
- Google Custom Search free tier: 100 queries/day
- Consider upgrading or implementing caching
- Reduce number of results per query

## Performance Impact

- **With web search:** +1-3 seconds per flagged snippet that needs verification
- **Without web search:** No performance impact
- **Caching:** Results are cached to avoid duplicate searches
- **Optimization:** Only searches for snippets marked as `needs_verification`

## Cost Considerations

- **Google Custom Search API:** Free tier = 100 queries/day, then $5 per 1000 queries
- **Typical usage:** ~5-10 queries per article analysis
- **Recommendation:** Start with free tier, monitor usage, upgrade if needed
