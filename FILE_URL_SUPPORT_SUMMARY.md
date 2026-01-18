# File URL Support for Veritas - Implementation Summary

## What Was Changed

Veritas now supports analyzing local HTML files loaded via `file://` URLs! This allows you to test the extension with the demo pages without needing to serve them from a web server.

## Changes Made

### 1. Updated Extension Manifest (`apps/extension/public/manifest.json`)
- Added `match_about_blank: true` to content scripts configuration
- This allows the content script to run on local file URLs

### 2. Updated App Logic (`apps/extension/src/App.tsx`)
- Removed `file://` URLs from the `isSpecialPage()` function
- Previously, `file://` URLs were blocked like `chrome://` internal pages
- Now `file://` URLs are treated as regular pages that can be analyzed

### 3. Created Documentation
- `demo/FILE_URL_SETUP.md` - Detailed instructions for enabling file URL access
- Updated `demo/README.md` - Added quick setup instructions

## How to Use

### Step 1: Rebuild the Extension

Since we modified the manifest and TypeScript files, you need to rebuild:

```bash
cd apps/extension
npm run build
```

### Step 2: Reload the Extension in Chrome

1. Open `chrome://extensions/`
2. Find "Veritas: Misinformation Detector"
3. Click the reload icon (circular arrow)

### Step 3: Enable File URL Access

**This is required - Chrome doesn't allow file URL access by default!**

1. Stay on `chrome://extensions/`
2. Find "Veritas: Misinformation Detector"
3. Click "Details"
4. Scroll down to "Allow access to file URLs"
5. Toggle it **ON** (should turn blue)

### Step 4: Test with Demo Files

Now you can test with local files:

```bash
# Open a demo file directly in Chrome
open demo/high-trust.html  # macOS
# or drag the file into Chrome

# Or use the file:// URL directly:
# file:///Users/arama/Projects/CruzHacks26/demo/high-trust.html
```

Then:
1. Click the Veritas extension icon
2. Click "Scan for Misinformation"
3. It should work! ✅

## Important Notes

### Chrome Security Requirement
- Users MUST manually enable "Allow access to file URLs" in Chrome extensions settings
- This is a Chrome security feature that cannot be bypassed programmatically
- Without this permission, the extension cannot access local files

### Demo Files Available
- `demo/high-trust.html` - Expected score: 85-95 (well-sourced)
- `demo/low-trust.html` - Expected score: 15-30 (sensationalized)
- `demo/mixed-trust.html` - Expected score: 50-65 (mixed quality)
- `demo/index.html` - Landing page with links to all demos

### Content Script Behavior
The content script will now:
- Run on `file://` URLs (if permission granted)
- Extract text from local HTML files
- Highlight snippets just like on web pages
- Cache results in local storage by file URL

## Troubleshooting

### "This page cannot be analyzed"
- ✅ Make sure you enabled "Allow access to file URLs" in extension settings
- ✅ Try reloading the HTML file after enabling
- ✅ Check the console for any errors (F12 → Console tab)

### Extension icon is grayed out
- ✅ Rebuild the extension: `npm run build` in `apps/extension/`
- ✅ Reload the extension in `chrome://extensions/`
- ✅ Reload the HTML file in your browser

### Content script not injecting
- ✅ Check that the extension is enabled
- ✅ Verify file URL permission is enabled
- ✅ Look for "[Veritas] Content script loaded" in DevTools console

## Technical Details

### Manifest V3 File URL Support
The key changes in `manifest.json`:
```json
"content_scripts": [
  {
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "match_about_blank": true,  // ← This enables file:// support
    "all_frames": false
  }
]
```

### URL Filtering Logic
Before (blocked file:// URLs):
```typescript
if (url.startsWith('file://')) {
  return true; // Blocked
}
```

After (allows file:// URLs):
```typescript
// Chrome internal pages (but NOT file:// URLs - those are allowed!)
if (url.startsWith('chrome://') || 
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:')) {
  return true;
}
// file:// URLs fall through and are allowed
```

## Next Steps

1. **Rebuild the extension** (see Step 1 above)
2. **Reload in Chrome** (see Step 2 above)
3. **Enable file URL access** (see Step 3 above)
4. **Test with demo files** (see Step 4 above)
5. **Take screenshots/videos** for your demo presentation!

## Questions?

See `demo/FILE_URL_SETUP.md` for more detailed instructions with examples.
