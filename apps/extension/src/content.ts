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

function highlightSingleSnippet(
  snippet: FlaggedSnippet,
  idx: number,
  snippetId: string,
  textToFind: string,
  maxHighlights: number
) {
  if (!articleRoot) return;

  // Create a fresh TreeWalker for this snippet
  const walker = document.createTreeWalker(
    articleRoot,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node;
  let foundCount = 0;

  while ((node = walker.nextNode()) && foundCount < maxHighlights) {
    const textContent = node.textContent || '';

    // Find all occurrences in this text node
    let startIndex = 0;
    let matchIndex = -1;

    while ((matchIndex = textContent.indexOf(textToFind, startIndex)) !== -1) {
      if (foundCount >= maxHighlights) {
        console.warn(`[Veritas] Reached max highlights (${maxHighlights}) for snippet ${idx}`);
        break;
      }

      try {
        const range = document.createRange();
        range.setStart(node, matchIndex);
        range.setEnd(node, matchIndex + textToFind.length);

        const highlight = document.createElement('mark');
        highlight.setAttribute('data-veritas-snippet-id', `${snippetId}-${foundCount}`);
        highlight.setAttribute('data-snippet-index', String(idx));
        highlight.className = 'veritas-highlight';
        highlight.style.cssText = getHighlightStyle(snippet.type, snippet.severity);
        highlight.title = `${snippet.type || 'Flagged'}: Click for details`;

        // Wrap the range with the highlight
        range.surroundContents(highlight);

        // Add click handler
        highlight.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          // Flash the highlight
          highlight.style.animation = 'veritas-pulse 0.5s ease-in-out';

          // Send message to extension to show this snippet
          chrome.runtime.sendMessage({
            action: 'SNIPPET_CLICKED',
            snippetIndex: idx
          });
        });

        currentHighlights.push({ element: highlight, snippetId: `${snippetId}-${foundCount}` });
        foundCount++;

        // Move past this occurrence
        startIndex = matchIndex + textToFind.length;

        // Re-create the walker since we modified the DOM
        break;
      } catch (error) {
        console.error(`[Veritas] Failed to highlight snippet ${idx}:`, error);
        startIndex = matchIndex + 1;
      }
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
    .veritas-highlight:hover {
      filter: brightness(1.2);
      transform: scale(1.02);
    }

    @keyframes veritas-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
  `;
  document.head.appendChild(style);
}

function scrollToSnippet(snippetIndex: number) {
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
