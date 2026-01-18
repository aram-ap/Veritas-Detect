// Content script to handle page interaction and text extraction

// Global state for highlights
let currentHighlights: { element: HTMLElement; snippetId: string }[] = [];
let articleRoot: HTMLElement | null = null;
let lastSnippets: FlaggedSnippet[] = []; // Store last snippets for restoration

function findArticleRoot(): HTMLElement {
  // Try to find article content using common selectors
  const articleSelectors = [
    'article',
    '[role="article"]',
    '.article-content',
    '.post-content',
    '.entry-content',
    '.story-body',
    '.article-body',
    'main',
    '.content'
  ];

  for (const selector of articleSelectors) {
    const element = document.querySelector(selector) as HTMLElement;
    if (element && element.textContent && element.textContent.trim().length > 200) {
      return element;
    }
  }

  // Fallback to body
  return document.body;
}

function extractArticleText(): string {
  // Find and set the article root
  articleRoot = findArticleRoot();

  // Get text content
  if (articleRoot === document.body) {
    // For body, filter out navigation, headers, footers
    const excludeSelectors = ['nav', 'header', 'footer', 'aside', '.sidebar', '.advertisement', '.ad', 'script', 'style', 'noscript'];
    const clone = articleRoot.cloneNode(true) as HTMLElement;
    excludeSelectors.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });
    return cleanText(clone.textContent || '');
  }

  return cleanText(articleRoot.textContent || '');
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')        // Normalize whitespace
    .replace(/\n+/g, '\n')       // Normalize line breaks
    .trim()
    .slice(0, 50000);            // Limit text length for API
}

function getPageTitle(): string {
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    return ogTitle.getAttribute('content') || '';
  }
  return document.title || '';
}

// Highlighting functions
function clearHighlights() {
  // Remove all tooltips
  document.querySelectorAll('.veritas-tooltip').forEach(tooltip => tooltip.remove());

  currentHighlights.forEach(({ element }) => {
    const parent = element.parentNode;
    if (parent) {
      // Replace highlight with original text
      const textNode = document.createTextNode(element.textContent || '');
      parent.replaceChild(textNode, element);
      parent.normalize(); // Merge adjacent text nodes
    }
  });
  currentHighlights = [];
}

interface FlaggedSnippet {
  text: string;
  type?: string;
  index?: number[];
  reason: string;
  severity?: 'low' | 'medium' | 'high';
  is_quote?: boolean;
  sources?: Array<{
    title: string;
    url: string;
    snippet: string;
    source: string;
    is_credible: boolean;
  }>;
}

function highlightSnippets(snippets: FlaggedSnippet[]) {
  clearHighlights();

  if (!snippets || snippets.length === 0) {
    console.log('[Veritas] No snippets to highlight');
    return;
  }

  // Ensure articleRoot is set
  if (!articleRoot) {
    console.log('[Veritas] Article root not set, finding it now...');
    articleRoot = findArticleRoot();
  }

  if (!articleRoot) {
    console.log('[Veritas] Could not find article root');
    return;
  }

  // Store snippets for potential restoration
  lastSnippets = snippets;

  console.log(`[Veritas] Highlighting ${snippets.length} snippets`);

  const MAX_HIGHLIGHTS_PER_SNIPPET = 50; // Safety limit to prevent infinite loops

  // Process snippets in chunks to avoid freezing the page
  let snippetIndex = 0;

  const processNextSnippet = () => {
    if (snippetIndex >= snippets.length) {
      console.log('[Veritas] Finished highlighting all snippets');
      return;
    }

    const snippet = snippets[snippetIndex];
    const idx = snippetIndex;
    snippetIndex++;

    // Process this snippet
    if (!snippet.index || snippet.index.length < 2) {
      console.log(`[Veritas] Snippet ${idx} has no index, skipping`);
      // Continue with next snippet
      setTimeout(processNextSnippet, 0);
      return;
    }

    const snippetId = `veritas-highlight-${idx}`;
    const textToFind = snippet.text.trim();

    if (!textToFind || textToFind.length === 0) {
      console.warn(`[Veritas] Snippet ${idx} has empty text, skipping`);
      setTimeout(processNextSnippet, 0);
      return;
    }

    // Use requestIdleCallback if available, otherwise setTimeout
    const scheduleWork = (callback: () => void) => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(callback, { timeout: 100 });
      } else {
        setTimeout(callback, 0);
      }
    };

    scheduleWork(() => {
      try {
        highlightSingleSnippet(snippet, idx, snippetId, textToFind, MAX_HIGHLIGHTS_PER_SNIPPET);
      } catch (error) {
        console.error(`[Veritas] Error highlighting snippet ${idx}:`, error);
      }

      // Continue with next snippet
      processNextSnippet();
    });
  };

  // Inject CSS if not already present
  injectHighlightStyles();

  // Start processing
  processNextSnippet();
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .trim();
}

function highlightSingleSnippet(
  snippet: FlaggedSnippet,
  idx: number,
  snippetId: string,
  textToFind: string,
  maxHighlights: number
) {
  if (!articleRoot) return;

  // Normalize the search text for better matching
  const normalizedSearch = normalizeText(textToFind);

  // Escape special regex characters and create flexible whitespace pattern
  const escapedSearch = normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flexiblePattern = escapedSearch.replace(/ /g, '\\s+');
  const regex = new RegExp(flexiblePattern, 'gi');

  let foundCount = 0;

  // Build a map of text content with node positions
  interface TextNodeInfo {
    node: Text;
    start: number;
    end: number;
    text: string;
  }

  const textNodes: TextNodeInfo[] = [];
  let concatenatedText = '';

  // Collect all text nodes and build concatenated text
  const walker = document.createTreeWalker(
    articleRoot,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node;
  while ((node = walker.nextNode())) {
    const textContent = (node as Text).textContent || '';
    if (textContent.trim().length > 0) {
      const start = concatenatedText.length;
      concatenatedText += textContent;
      const end = concatenatedText.length;

      textNodes.push({
        node: node as Text,
        start,
        end,
        text: textContent
      });
    }
  }

  // Search for matches in the concatenated text
  let match;
  const matches: { start: number; end: number }[] = [];

  while ((match = regex.exec(concatenatedText)) !== null && matches.length < maxHighlights) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length
    });
  }

  console.log(`[Veritas] Found ${matches.length} potential matches for snippet ${idx}`);

  // Process each match
  for (const match of matches) {
    if (foundCount >= maxHighlights) break;

    try {
      // Find which text nodes this match spans
      const affectedNodes: Array<{ node: Text; startOffset: number; endOffset: number }> = [];

      for (const nodeInfo of textNodes) {
        // Check if this node contains any part of the match
        if (match.start < nodeInfo.end && match.end > nodeInfo.start) {
          const startOffset = Math.max(0, match.start - nodeInfo.start);
          const endOffset = Math.min(nodeInfo.text.length, match.end - nodeInfo.start);

          affectedNodes.push({
            node: nodeInfo.node,
            startOffset,
            endOffset
          });
        }
      }

      if (affectedNodes.length === 0) continue;

      // Create highlights for each affected node (in reverse to preserve positions)
      const highlightElements: HTMLElement[] = [];

      for (let i = affectedNodes.length - 1; i >= 0; i--) {
        const { node, startOffset, endOffset } = affectedNodes[i];

        try {
          const range = document.createRange();
          range.setStart(node, startOffset);
          range.setEnd(node, endOffset);

          const highlight = document.createElement('mark');
          highlight.setAttribute('data-veritas-snippet-id', `${snippetId}-${foundCount}`);
          highlight.setAttribute('data-snippet-index', String(idx));
          highlight.className = 'veritas-highlight';
          highlight.style.cssText = getHighlightStyle(snippet.type, snippet.severity, snippet.is_quote);
          highlight.title = `${snippet.type || 'Flagged'}: Click to expand`;

          // Wrap the range with the highlight
          range.surroundContents(highlight);
          highlightElements.unshift(highlight); // Add to start to maintain order
        } catch (error) {
          console.error(`[Veritas] Failed to wrap range for snippet ${idx}:`, error);
          // Continue with other nodes even if one fails
        }
      }

      // Add click handlers to all highlight elements for this match
      highlightElements.forEach(highlight => {
        highlight.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          // Toggle expansion
          const isExpanded = highlight.classList.contains('veritas-expanded');

          // Remove expansion from all highlights
          document.querySelectorAll('.veritas-highlight.veritas-expanded').forEach(h => {
            h.classList.remove('veritas-expanded');
          });

          // Remove all tooltips
          document.querySelectorAll('.veritas-tooltip').forEach(t => t.remove());

          if (!isExpanded) {
            // Expand all parts of this highlight (persistent)
            highlightElements.forEach(el => el.classList.add('veritas-expanded'));

            // Create tooltip with full context
            const tooltip = document.createElement('div');
            tooltip.className = 'veritas-tooltip';
            tooltip.innerHTML = `
              <div class="veritas-tooltip-header">
                <strong>${snippet.type || 'Flagged Content'}</strong>
                <button class="veritas-tooltip-close" aria-label="Close">&times;</button>
              </div>
              <div class="veritas-tooltip-body">
                <p class="veritas-tooltip-reason">${snippet.reason}</p>
                ${snippet.severity ? `<span class="veritas-tooltip-severity veritas-severity-${snippet.severity}">${snippet.severity.toUpperCase()}</span>` : ''}
              </div>
            `;

            // Position tooltip near the first highlight element
            const rect = highlightElements[0].getBoundingClientRect();
            tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
            tooltip.style.left = `${rect.left + window.scrollX}px`;

            document.body.appendChild(tooltip);

            // Close button handler - only closes tooltip, keeps outline
            tooltip.querySelector('.veritas-tooltip-close')?.addEventListener('click', () => {
              tooltip.remove();
            });

            // Auto-close tooltip when clicking outside (but keep the outline)
            setTimeout(() => {
              const closeOnClickOutside = (event: MouseEvent) => {
                if (!tooltip.contains(event.target as Node) && !highlightElements.some(el => el === event.target)) {
                  tooltip.remove();
                  document.removeEventListener('click', closeOnClickOutside);
                }
              };
              document.addEventListener('click', closeOnClickOutside);
            }, 100);
          }

          // Send message to extension to show this snippet
          chrome.runtime.sendMessage({
            action: 'SNIPPET_CLICKED',
            snippetIndex: idx
          });
        });

        currentHighlights.push({ element: highlight, snippetId: `${snippetId}-${foundCount}` });
      });

      foundCount++;
    } catch (error) {
      console.error(`[Veritas] Failed to highlight snippet ${idx}:`, error);
    }
  }

  if (foundCount === 0) {
    console.warn(`[Veritas] Could not find text for snippet ${idx}: "${textToFind.substring(0, 100)}..."`);
  } else {
    console.log(`[Veritas] Total occurrences highlighted for snippet ${idx}: ${foundCount}`);
  }
}

function getHighlightStyle(type?: string, _severity?: 'low' | 'medium' | 'high', isQuote?: boolean): string {
  const baseStyle = 'cursor: pointer; transition: all 0.2s ease;';

  const t = (type || '').toLowerCase();

  // If it's quoted content or type includes "quoted", use blue color scheme
  if (isQuote || t.includes('quoted')) {
    if (t.includes('misinformation') || t.includes('disinformation')) {
      return baseStyle + 'background-color: rgba(59, 130, 246, 0.25); border-bottom: 2px solid rgb(59, 130, 246);';
    } else if (t.includes('propaganda')) {
      return baseStyle + 'background-color: rgba(14, 165, 233, 0.25); border-bottom: 2px solid rgb(14, 165, 233);';
    } else if (t.includes('fallacy')) {
      return baseStyle + 'background-color: rgba(6, 182, 212, 0.25); border-bottom: 2px solid rgb(6, 182, 212);';
    }
    // Default quoted highlight
    return baseStyle + 'background-color: rgba(37, 99, 235, 0.25); border-bottom: 2px solid rgb(37, 99, 235);';
  }

  // Regular (non-quoted) content colors
  if (t.includes('misinformation')) {
    return baseStyle + 'background-color: rgba(239, 68, 68, 0.25); border-bottom: 2px solid rgb(239, 68, 68);';
  } else if (t.includes('disinformation')) {
    return baseStyle + 'background-color: rgba(244, 63, 94, 0.25); border-bottom: 2px solid rgb(244, 63, 94);';
  } else if (t.includes('propaganda')) {
    return baseStyle + 'background-color: rgba(249, 115, 22, 0.25); border-bottom: 2px solid rgb(249, 115, 22);';
  } else if (t.includes('fallacy')) {
    return baseStyle + 'background-color: rgba(251, 191, 36, 0.25); border-bottom: 2px solid rgb(251, 191, 36);';
  }

  return baseStyle + 'background-color: rgba(156, 163, 175, 0.25); border-bottom: 2px solid rgb(156, 163, 175);';
}

function injectHighlightStyles() {
  if (document.getElementById('veritas-highlight-styles')) return;

  const style = document.createElement('style');
  style.id = 'veritas-highlight-styles';
  style.textContent = `
    /* Base highlight styles */
    .veritas-highlight {
      position: relative;
      transition: all 0.2s ease;
    }

    /* Hover effect - make lighter and show only underline */
    .veritas-highlight:hover {
      background-color: transparent !important;
      border-bottom-width: 3px !important;
      filter: brightness(1.3);
    }

    /* Expanded state */
    .veritas-highlight.veritas-expanded {
      background-color: rgba(255, 255, 255, 0.2) !important;
      border-bottom-width: 4px !important;
      outline: 3px solid black;
      outline-offset: 3px;
      border-radius: 3px;
    }

    /* Tooltip styles */
    .veritas-tooltip {
      position: absolute;
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 0;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
      z-index: 10000;
      max-width: 350px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: veritas-tooltip-appear 0.2s ease-out;
    }

    .veritas-tooltip-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px 8px 0 0;
    }

    .veritas-tooltip-header strong {
      color: #ffffff;
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .veritas-tooltip-close {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.6);
      font-size: 20px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s ease;
    }

    .veritas-tooltip-close:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }

    .veritas-tooltip-body {
      padding: 12px 16px;
    }

    .veritas-tooltip-reason {
      color: rgba(255, 255, 255, 0.9);
      font-size: 13px;
      line-height: 1.5;
      margin: 0 0 8px 0;
    }

    .veritas-tooltip-severity {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .veritas-severity-low {
      background: rgba(251, 191, 36, 0.2);
      color: #fbbf24;
      border: 1px solid rgba(251, 191, 36, 0.3);
    }

    .veritas-severity-medium {
      background: rgba(249, 115, 22, 0.2);
      color: #f97316;
      border: 1px solid rgba(249, 115, 22, 0.3);
    }

    .veritas-severity-high {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    @keyframes veritas-tooltip-appear {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes veritas-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
  `;
  document.head.appendChild(style);
}

function scrollToSnippet(snippetIndex: number) {
  // Remove any existing tooltips
  document.querySelectorAll('.veritas-tooltip').forEach(tooltip => tooltip.remove());

  // Remove expanded state from all highlights
  document.querySelectorAll('.veritas-highlight.veritas-expanded').forEach(h => {
    h.classList.remove('veritas-expanded');
  });

  // Find all highlights for this snippet (there may be multiple occurrences)
  const highlights = currentHighlights.filter(h =>
    h.snippetId.startsWith(`veritas-highlight-${snippetIndex}`)
  );

  if (highlights.length > 0) {
    // Scroll to the first occurrence
    const firstHighlight = highlights[0];
    firstHighlight.element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    // Add expanded class to show border/outline effect (persistent)
    highlights.forEach(highlight => {
      highlight.element.classList.add('veritas-expanded');
    });

    // Flash all occurrences of this snippet with pulse animation
    highlights.forEach(highlight => {
      highlight.element.style.animation = 'none';
      setTimeout(() => {
        highlight.element.style.animation = 'veritas-pulse 0.5s ease-in-out 3';
      }, 10);
    });

    console.log(`[Veritas] Scrolled to snippet ${snippetIndex} (${highlights.length} occurrence(s))`);
  } else {
    console.warn(`[Veritas] Snippet ${snippetIndex} not found for scrolling`);
  }
}

// Function to restore highlights from storage
function restoreHighlightsFromStorage() {
  const currentUrl = window.location.href;
  const highlightKey = `highlights_${currentUrl}`;

  console.log('[Veritas] Attempting to restore highlights for:', currentUrl);

  chrome.storage.local.get([highlightKey], (result) => {
    const savedHighlights = result[highlightKey];
    if (savedHighlights && Array.isArray(savedHighlights) && savedHighlights.length > 0) {
      console.log(`[Veritas] Found ${savedHighlights.length} saved highlights, restoring...`);

      // Ensure articleRoot is found before highlighting
      if (!articleRoot) {
        articleRoot = findArticleRoot();
      }

      // Apply highlights
      highlightSnippets(savedHighlights);

      console.log('[Veritas] Highlights restoration complete');
    } else {
      console.log('[Veritas] No saved highlights found for this URL');
    }
  });
}

// Auto-restore highlights on page load
(function autoRestoreHighlights() {
  console.log('[Veritas] Content script initialized, document state:', document.readyState);

  // Function to wait for page to be ready and then restore
  const waitAndRestore = (delay: number) => {
    setTimeout(() => {
      // Double-check that the page is ready
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        restoreHighlightsFromStorage();
      } else {
        console.log('[Veritas] Page not ready yet, waiting...');
        waitAndRestore(500);
      }
    }, delay);
  };

  // Wait for page to be fully loaded
  if (document.readyState === 'loading') {
    // Page is still loading, wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[Veritas] DOMContentLoaded event fired');
      waitAndRestore(800); // Give more time for dynamic content to load
    });
  } else if (document.readyState === 'interactive') {
    // DOM is ready but resources may still be loading
    console.log('[Veritas] Document is interactive, waiting for complete...');
    window.addEventListener('load', () => {
      console.log('[Veritas] Window load event fired');
      waitAndRestore(500);
    });
  } else {
    // Page already fully loaded
    console.log('[Veritas] Document already complete');
    waitAndRestore(500);
  }

  // Listen for page visibility changes (when user switches back to tab)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentHighlights.length === 0 && lastSnippets.length === 0) {
      console.log('[Veritas] Page became visible with no highlights, checking storage');
      setTimeout(restoreHighlightsFromStorage, 300);
    }
  });

  // Listen for page navigation (for SPAs)
  let lastUrl = window.location.href;
  new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      console.log('[Veritas] URL changed from', lastUrl, 'to', currentUrl);
      lastUrl = currentUrl;
      clearHighlights();
      setTimeout(restoreHighlightsFromStorage, 1200);
    }
  }).observe(document, { subtree: true, childList: true });
})();

// Message listener
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'EXTRACT_TEXT') {
    const text = extractArticleText();
    const title = getPageTitle();

    sendResponse({
      text,
      title,
      url: window.location.href
    });
  } else if (request.action === 'HIGHLIGHT_SNIPPETS') {
    console.log('[Veritas] Received HIGHLIGHT_SNIPPETS message', request.snippets);
    try {
      highlightSnippets(request.snippets);
      sendResponse({ success: true });
    } catch (error) {
      console.error('[Veritas] Error highlighting snippets:', error);
      sendResponse({ success: false, error: String(error) });
    }
    return true; // Keep message channel open
  } else if (request.action === 'RESTORE_HIGHLIGHTS') {
    console.log('[Veritas] Received RESTORE_HIGHLIGHTS message');
    try {
      // Re-highlight using stored snippets
      if (lastSnippets.length > 0) {
        highlightSnippets(lastSnippets);
        sendResponse({ success: true, restored: true });
      } else {
        console.log('[Veritas] No snippets to restore');
        sendResponse({ success: true, restored: false });
      }
    } catch (error) {
      console.error('[Veritas] Error restoring highlights:', error);
      sendResponse({ success: false, error: String(error) });
    }
    return true; // Keep message channel open
  } else if (request.action === 'SCROLL_TO_SNIPPET') {
    console.log('[Veritas] Received SCROLL_TO_SNIPPET message', request.snippetIndex);
    try {
      scrollToSnippet(request.snippetIndex);
      sendResponse({ success: true });
    } catch (error) {
      console.error('[Veritas] Error scrolling to snippet:', error);
      sendResponse({ success: false, error: String(error) });
    }
    return true; // Keep message channel open
  } else if (request.action === 'CLEAR_HIGHLIGHTS') {
    try {
      clearHighlights();
      sendResponse({ success: true });
    } catch (error) {
      console.error('[Veritas] Error clearing highlights:', error);
      sendResponse({ success: false, error: String(error) });
    }
    return true; // Keep message channel open
  }
  return true;
});

// Announce that content script is loaded
console.log('[Veritas] Content script loaded');
