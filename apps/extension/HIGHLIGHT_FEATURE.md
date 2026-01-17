# Interactive Webpage Highlighting Feature

## Overview

The extension now features **two-way interactive highlighting** between flagged content on webpages and the extension panel. This creates a seamless experience for investigating misinformation.

## Features

### 1. Automatic Webpage Highlighting

When you analyze a page, **all occurrences** of flagged phrases are automatically highlighted directly on the webpage with:
- **Color-coded highlights** based on flag type:
  - 🔴 Red: Misinformation
  - 🌹 Rose: Disinformation
  - 🟠 Orange: Propaganda
  - 🟡 Yellow: Logical Fallacy
  - ⚪ Gray: General suspicious content
- **Underline border** for visibility
- **Hover effects** for interactivity
- **Tooltips** showing the flag type
- **Multiple occurrences**: If the same phrase appears multiple times, all are highlighted

### 2. Click Highlights on Page → Open in Extension

When you click a highlighted phrase on the webpage:
- Extension panel opens automatically (side panel)
- The corresponding flagged item scrolls into view
- The item briefly flashes to draw attention
- Details are revealed

### 3. Click Flags in Extension → Jump to Page Location

When you click a flagged item in the extension:
- The webpage automatically scrolls to that phrase
- The highlight pulses 3 times to grab your attention
- Page is centered on the flagged content

## How to Use

### Basic Workflow

1. **Analyze a page**: Click "Scan for Misinformation"
2. **Review results**: See trust score, bias, and flagged snippets
3. **Investigate interactively**:
   - **Option A**: Click highlights on the webpage to see analysis in extension
   - **Option B**: Click flagged items in extension to jump to location on page

### Visual Indicators

**In the Extension:**
- 📍 Location pin icon on each flagged item
- "Click to jump to location on page" hint text
- Selected items show a white ring border
- Hover effects for clickability

**On the Webpage:**
- Semi-transparent colored background
- Solid colored underline
- Cursor changes to pointer on hover
- Tooltip shows flag type

## Technical Details

### Message Passing

The extension uses Chrome's message passing API for communication:

```javascript
// Extension → Content Script
chrome.tabs.sendMessage(tabId, {
  action: 'HIGHLIGHT_SNIPPETS',
  snippets: [...flaggedSnippets]
});

// Content Script → Extension
chrome.runtime.sendMessage({
  action: 'SNIPPET_CLICKED',
  snippetIndex: 0
});
```

### Highlight Persistence

- Highlights are **cached** with analysis results
- Switching tabs and coming back restores highlights
- **Automatically cleared when extension panel is closed** (privacy feature)
- Cleared when you click "Scan Another Page"
- Automatically cleared when navigating to a different URL

### Smart Text Matching

The content script uses:
- **TreeWalker API** to traverse text nodes efficiently
- **Multiple occurrence matching** - highlights all instances of each flagged phrase
- **Exact substring matching** for accuracy
- **Range API** for precise highlighting without breaking page layout
- **Per-snippet TreeWalker** - fresh traversal for each snippet ensures all are found

## Styling

### Highlight CSS

Highlights are styled with:
- `<mark>` elements for semantic HTML
- Inline styles for reliability across different websites
- CSS animations for pulsing effects
- Smooth transitions for hover states

### Extension UI

Flagged items feature:
- Ring border when selected
- Scale animation on click
- Brightness increase on hover
- Smooth scrolling in panel

## Troubleshooting

### Highlights Don't Appear

**Possible causes:**
1. Content script not loaded
   - Extension automatically injects it
   - Check console for "[Veritas] Content script loaded"

2. Snippets have no text indices
   - Backend must provide `index: [start, end]` for each snippet
   - Check API response format

3. Text not found on page
   - Article content may have changed
   - Text might be in an iframe (not currently supported)

**Solutions:**
- Reload the page
- Re-run analysis with "Force Refresh"
- Check browser console for errors

### Highlights Appear Multiple Times

This is expected behavior!
- If flagged text appears multiple times on the page, **all occurrences are highlighted**
- When you click a flagged item in the extension, it scrolls to the **first occurrence** and **flashes all occurrences**
- This helps you see if problematic phrases are being repeated throughout the article

### Highlights Don't Disappear When Extension Closes

This should work automatically:
- Highlights are cleared when the extension panel is closed or hidden
- Highlights are also cleared when you close Chrome completely
- If highlights persist, manually clear them by clicking "Scan Another Page" and then closing

**Why this feature?**
- **Privacy**: Doesn't leave visual marks on the page after you're done analyzing
- **Cleaner browsing**: Pages return to normal when you close the extension
- **Fresh analysis**: Re-opening the extension shows cached results and re-highlights

### Extension Panel Doesn't Open on Click

**Note:** Extension uses a side panel (not popup)
- Side panel must be enabled in Chrome
- Click the extension icon to manually open
- Ensure you're on Chrome 114+ for side panel support

### Scrolling Doesn't Work

Check:
- Webpage has scrollable content
- Content is not in an iframe
- Browser allows smooth scrolling
- Console for any JavaScript errors

## Browser Compatibility

### Required

- **Chrome 114+** (for side panel support)
- **Manifest V3** extension support

### Tested On

- ✅ Chrome 120+
- ✅ Edge 120+
- ❌ Firefox (side panel API differs)
- ❌ Safari (no Manifest V3 support)

## Performance

### Optimization Features

- Highlights only first occurrence (avoids lag on long pages)
- TreeWalker for efficient text traversal
- Cached highlights avoid re-computation
- Debounced animations

### Tested With

- ✅ Articles with 5,000+ words
- ✅ Up to 10 highlighted snippets
- ✅ Pages with complex DOM structures

## Privacy & Security

- **No data leaves your browser** during highlighting
- Text matching happens entirely client-side
- Highlights use inline styles (no external CSS)
- No modification of page JavaScript
- No tracking of user clicks

## Future Enhancements

Potential improvements:

- [ ] Support for iframe content
- [ ] Multi-occurrence highlighting
- [ ] Keyboard navigation (Tab through highlights)
- [ ] Export highlighted version of page
- [ ] Annotation/note-taking on highlights
- [ ] Highlight filtering by severity
- [ ] Custom highlight colors/styles

## Known Limitations

1. **No iframes**: Content inside iframes is not highlighted
2. **Dynamic Content**: Highlights may break if page content changes after analysis
3. **Side Panel Only**: Requires side panel support (Chrome 114+)
4. **Text-based**: Can't highlight images or videos
5. **DOM Modification**: Very complex pages may have highlighting issues due to DOM mutations

## Development

### Key Files

- `apps/extension/src/content.ts` - Content script with highlighting logic
- `apps/extension/src/App.tsx` - Extension panel with message handling
- `apps/extension/src/components/FlaggedContent.tsx` - Clickable snippet UI

### Testing Locally

1. Build extension: `npm run build`
2. Load unpacked extension in Chrome
3. Navigate to a news article
4. Click "Scan for Misinformation"
5. Test both click directions:
   - Click highlights on page
   - Click items in extension panel

### Debugging

Enable verbose logging:
```javascript
// In browser console
localStorage.setItem('veritas-debug', 'true');
```

Check for messages:
- `[Veritas] Highlighted snippet X: "..."`
- `[Veritas] Snippet clicked on page: X`
- `[Veritas] Sent highlights to content script`

## API Requirements

The backend `/api/analyze` endpoint must return:

```json
{
  "flagged_snippets": [
    {
      "text": "exact text from article",
      "type": "Misinformation",
      "reason": "explanation",
      "index": [startPosition, endPosition],
      "severity": "high"
    }
  ]
}
```

**Critical:** The `index` field is required for highlighting to work.

## Support

For issues:
1. Check browser console for errors
2. Verify backend returns `index` in snippets
3. Ensure Chrome 114+ is being used
4. Try reloading the page and extension
