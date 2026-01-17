// Content script to handle page interaction and text extraction

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
    const element = document.querySelector(selector);
    if (element && element.textContent && element.textContent.trim().length > 200) {
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
  }
  return true;
});

// Announce that content script is loaded
console.log('[Veritas] Content script loaded');
