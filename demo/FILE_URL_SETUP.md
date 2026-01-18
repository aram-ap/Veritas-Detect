# Using Veritas with Local HTML Files (file:// URLs)

Veritas now supports analyzing local HTML files loaded via `file://` URLs! This is perfect for testing with the demo pages.

## Quick Setup

To enable file URL access for the Veritas extension:

### Chrome / Edge

1. **Open Extensions Page**
   - Navigate to `chrome://extensions/` (or `edge://extensions/` for Edge)
   - Or click the puzzle icon in your toolbar → "Manage Extensions"

2. **Find Veritas Extension**
   - Look for "Veritas: Misinformation Detector" in your extensions list

3. **Enable File Access**
   - Click "Details" button on the Veritas extension card
   - Scroll down to find "Allow access to file URLs"
   - Toggle the switch to **ON** (it should turn blue)

4. **Test It Out!**
   - Open any local HTML file in your browser (e.g., `file:///Users/arama/Projects/CruzHacks26/demo/high-trust.html`)
   - Click the Veritas extension icon
   - Click "Scan for Misinformation" - it should work now!

## Why This Is Needed

For security reasons, Chrome extensions don't have access to local files by default. You must manually grant this permission. This is a Chrome security feature that cannot be bypassed programmatically.

## Demo Files

The demo folder includes three test articles:

- **high-trust.html** - Well-sourced, balanced article (expected score: 85-95)
- **low-trust.html** - Sensationalized content with conspiracy elements (expected score: 15-30)
- **mixed-trust.html** - Mixed factual and misleading content (expected score: 50-65)

## Opening Demo Files

You can open these files by:

1. **Drag and drop** the HTML file into your browser window
2. **File menu**: File → Open File → Select the HTML file
3. **Command line**: 
   ```bash
   open demo/high-trust.html  # macOS
   start demo/high-trust.html # Windows
   xdg-open demo/high-trust.html # Linux
   ```
4. **Direct URL**: Type in address bar: `file:///full/path/to/demo/high-trust.html`

## Troubleshooting

### "This page cannot be analyzed" message

- Make sure you've enabled "Allow access to file URLs" in the extension settings
- After enabling, try reloading the HTML file
- If it still doesn't work, try disabling and re-enabling the extension

### Extension not injecting

- Check that the extension is enabled in `chrome://extensions/`
- Try reloading the extension (click the reload icon in `chrome://extensions/`)
- Reload the HTML file after reloading the extension

### Content script errors

- Open DevTools (F12) and check the Console tab for any errors
- The content script should log "[Veritas] Content script loaded" when it initializes
