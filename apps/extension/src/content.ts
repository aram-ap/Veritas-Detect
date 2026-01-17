// Content script to handle page interaction and text extraction

// Global state for highlights
let currentHighlights: { element: HTMLElement; snippetId: string }[] = [];
let articleRoot: HTMLElement | null = null;

function extractArticleText(): string {
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
      articleRoot = element; // Store for later highlighting
      return cleanText(element.textContent);
    }
  }

  // Fallback: get main body text, filtering out navigation, headers, footers
  const body = document.body;
  const excludeSelectors = ['nav', 'header', 'footer', 'aside', '.sidebar', '.advertisement', '.ad', 'script', 'style', 'noscript'];

  const clone = body.cloneNode(true) as HTMLElement;

  // Remove excluded elements from clone
  excludeSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });

  articleRoot = body; // Fallback to body
  return cleanText(clone.textContent || '');
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
}

function highlightSnippets(snippets: FlaggedSnippet[]) {
  clearHighlights();

  if (!articleRoot || !snippets || snippets.length === 0) {
    console.log('[Veritas] No snippets to highlight or article root not found');
    return;
  }

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
          highlight.style.cssText = getHighlightStyle(snippet.type, snippet.severity);
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
            // Expand all parts of this highlight
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

            // Close button handler
            tooltip.querySelector('.veritas-tooltip-close')?.addEventListener('click', () => {
              tooltip.remove();
              highlightElements.forEach(el => el.classList.remove('veritas-expanded'));
            });

            // Auto-close when clicking outside
            setTimeout(() => {
              const closeOnClickOutside = (event: MouseEvent) => {
                if (!tooltip.contains(event.target as Node) && !highlightElements.some(el => el === event.target)) {
                  tooltip.remove();
                  highlightElements.forEach(el => el.classList.remove('veritas-expanded'));
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

function getHighlightStyle(type?: string, _severity?: 'low' | 'medium' | 'high'): string {
  const baseStyle = 'cursor: pointer; transition: all 0.2s ease;';

  const t = (type || '').toLowerCase();

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
      background-color: rgba(255, 255, 255, 0.15) !important;
      outline: 2px solid currentColor;
      outline-offset: 2px;
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

    // Flash all occurrences of this snippet
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
