import { useState, useEffect, useCallback, useRef } from 'react';
import { TrustDial } from './components/TrustDial';
import { FlaggedContent, type FlaggedSnippet } from './components/FlaggedContent';
import { API_ENDPOINTS, COOKIE_CONFIG, API_BASE_URL } from './config';
import './index.css';

interface AnalysisResult {
  score: number;
  bias: string;
  flagged_snippets: FlaggedSnippet[];
  summary?: string;
  metadata?: {
    model?: string;
    source?: string;
  };
}

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

function App() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [userName, setUserName] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [selectedSnippetIndex, setSelectedSnippetIndex] = useState<number | null>(null);
  const snippetRefs = useRef<(HTMLDivElement | null)[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      console.log('[Veritas] Checking authentication...');

      // Call the extension-token endpoint which creates a readable cookie and returns user info
      const res = await fetch(API_ENDPOINTS.AUTH_EXTENSION_TOKEN, {
        credentials: 'include' // Send httpOnly cookies automatically
      });

      console.log('[Veritas] Extension token response:', res.status);

      if (!res.ok) {
        console.log('[Veritas] Extension token request failed');
        setAuthState('unauthenticated');
        return;
      }

      const data = await res.json();
      console.log('[Veritas] Extension token data:', data);

      if (data.authenticated && data.user) {
        // Now check if the readable cookie was set
        const authCookie = await chrome.cookies.get({
          url: COOKIE_CONFIG.url,
          name: COOKIE_CONFIG.authCookieName
        });

        console.log('[Veritas] Readable auth cookie:', authCookie);

        setAuthState('authenticated');
        setUserName(data.user.name || data.user.nickname || data.user.email || 'User');
      } else {
        console.log('[Veritas] Not authenticated');
        setAuthState('unauthenticated');
      }
    } catch (err) {
      console.error('[Veritas] Auth check error:', err);
      setAuthState('unauthenticated');
    }
  }, []);

  // Helper function to update current tab URL
  const updateCurrentTabUrl = useCallback(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        console.log('[Veritas] Current tab URL:', tabs[0].url);
        setCurrentUrl(tabs[0].url);
        // Don't clear results here - let the cache effect handle it
      }
    });
  }, []);

  useEffect(() => {
    checkAuth();
    updateCurrentTabUrl();

    // Re-check auth when the document becomes visible
    // Clear highlights when panel is hidden/closed, restore when reopened
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        checkAuth();
        updateCurrentTabUrl();

        // Restore highlights if we have results
        if (result && result.flagged_snippets && result.flagged_snippets.length > 0) {
          try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab.id) {
              await chrome.tabs.sendMessage(tab.id, { action: 'RESTORE_HIGHLIGHTS' });
              console.log('[Veritas] Restored highlights on panel reopen');
            }
          } catch (error) {
            console.log('[Veritas] Could not restore highlights:', error);
          }
        }
      } else if (document.visibilityState === 'hidden') {
        // Extension panel is closing/hidden - clear highlights
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab.id) {
            await chrome.tabs.sendMessage(tab.id, { action: 'CLEAR_HIGHLIGHTS' });
            console.log('[Veritas] Cleared highlights on panel close');
          }
        } catch (error) {
          // Tab may have closed or content script not ready - that's ok
          console.log('[Veritas] Could not clear highlights (tab may be closed)');
        }
      }
    };

    // Listen for tab switches - cancel analysis when switching tabs
    const handleTabActivated = () => {
      // Cancel ongoing analysis when switching tabs
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        console.log('[Veritas] Cancelled analysis due to tab switch');
      }
      updateCurrentTabUrl();
    };

    // Listen for URL changes in the current tab - cancel analysis when URL changes
    const handleTabUpdated = (tabId: number, changeInfo: { url?: string }) => {
      if (changeInfo.url) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id === tabId) {
            // Cancel ongoing analysis when URL changes
            if (abortControllerRef.current) {
              abortControllerRef.current.abort();
              console.log('[Veritas] Cancelled analysis due to URL change');
            }
            updateCurrentTabUrl();
          }
        });
      }
    };

    // Listen for tab removal - cancel analysis if tab is closed
    const handleTabRemoved = (tabId: number) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id === tabId) {
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            console.log('[Veritas] Cancelled analysis due to tab close');
          }
        }
      });
    };

    // Listen for messages from content script (e.g., snippet clicked on page)
    const handleMessage = (message: { action: string; snippetIndex?: number }) => {
      if (message.action === 'SNIPPET_CLICKED' && typeof message.snippetIndex === 'number') {
        console.log('[Veritas] Snippet clicked on page:', message.snippetIndex);
        const snippetIndex = message.snippetIndex;
        setSelectedSnippetIndex(snippetIndex);
        // Scroll to the snippet in the extension UI
        setTimeout(() => {
          const snippetEl = snippetRefs.current[snippetIndex];
          if (snippetEl) {
            snippetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Flash animation
            snippetEl.style.animation = 'none';
            setTimeout(() => {
              snippetEl.style.animation = 'flash-snippet 0.5s ease-in-out';
            }, 10);
          }
        }, 100);
      }
    };

    // Clear highlights when extension is about to unload
    const handleBeforeUnload = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab.id) {
          await chrome.tabs.sendMessage(tab.id, { action: 'CLEAR_HIGHLIGHTS' });
        }
      } catch (error) {
        // Ignore errors during unload
      }
    };

    // Poll for auth when unauthenticated (in case user logged in via another tab)
    const interval = setInterval(() => {
      if (authState === 'unauthenticated') {
        checkAuth();
      }
    }, 3000);

    // Add all event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    chrome.tabs.onActivated.addListener(handleTabActivated);
    chrome.tabs.onUpdated.addListener(handleTabUpdated);
    chrome.tabs.onRemoved.addListener(handleTabRemoved);
    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      chrome.tabs.onActivated.removeListener(handleTabActivated);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
      chrome.tabs.onRemoved.removeListener(handleTabRemoved);
      chrome.runtime.onMessage.removeListener(handleMessage);
      clearInterval(interval);
    };
  }, [checkAuth, authState, updateCurrentTabUrl, result]);

  const handleLogin = () => {
    chrome.tabs.create({ url: API_ENDPOINTS.AUTH_LOGIN });
  };

  const handleLogout = async () => {
    // Clear the extension auth cookie
    await chrome.cookies.remove({
      url: COOKIE_CONFIG.url,
      name: COOKIE_CONFIG.authCookieName
    });

    chrome.tabs.create({ url: API_ENDPOINTS.AUTH_LOGOUT });
    setAuthState('unauthenticated');
    setResult(null);
  };

  const handleAnalyze = async (forceRefresh = true) => {
    // Cancel any ongoing analysis
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this analysis
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Clear existing highlights before starting new analysis
      if (tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'CLEAR_HIGHLIGHTS' });
        } catch (e) {
          // Content script may not be ready, that's ok
          console.log('[Veritas] Could not clear highlights:', e);
        }
      }
      if (!tab.id) {
        throw new Error('No active tab found');
      }

      // Check if aborted
      if (abortController.signal.aborted) {
        throw new Error('Analysis cancelled');
      }

      // Request text from content script
      let response;
      try {
        response = await chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_TEXT' });
      } catch (err) {
        // If content script is not ready, try to inject it
        console.log('Content script not ready, injecting...');
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });

        // Retry message
        response = await chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_TEXT' });
      }

      if (!response || !response.text) {
        throw new Error('Could not extract page content');
      }

      // Check if aborted
      if (abortController.signal.aborted) {
        throw new Error('Analysis cancelled');
      }

      console.log('[Veritas] Sending text to API:', response.text.substring(0, 100) + '...');

      // Send analyze request with credentials (browser automatically includes httpOnly cookies)
      const analyzeRes = await fetch(API_ENDPOINTS.ANALYZE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Automatically send cookies
        body: JSON.stringify({
          text: response.text,
          title: response.title,
          url: tab.url,
          forceRefresh
        }),
        signal: abortController.signal, // Add abort signal
      });

      if (!analyzeRes.ok) {
        if (analyzeRes.status === 401) {
          throw new Error('Session expired. Please sign in again.');
        }
        throw new Error('Analysis failed');
      }

      const data = await analyzeRes.json();
      console.log('[Veritas] API Response:', data); // Debug log
      setResult(data);

      // Cache the result locally for this URL
      if (tab.url) {
        chrome.storage.local.set({ [tab.url]: data });

        // Also save highlights separately for persistence across reloads
        if (data.flagged_snippets && data.flagged_snippets.length > 0) {
          const highlightKey = `highlights_${tab.url}`;
          chrome.storage.local.set({ [highlightKey]: data.flagged_snippets });
        }
      }

      // Send highlights to content script (non-blocking, don't await)
      if (data.flagged_snippets && data.flagged_snippets.length > 0 && tab.id) {
        // Use setTimeout to make this truly non-blocking
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id!, {
              action: 'HIGHLIGHT_SNIPPETS',
              snippets: data.flagged_snippets
            });
            console.log('[Veritas] Sent highlights to content script');
          } catch (highlightError) {
            console.error('[Veritas] Failed to send highlights:', highlightError);
          }
        }, 100); // Small delay to ensure UI updates first
      }
    } catch (err) {
      // Don't show error if analysis was cancelled
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[Veritas] Analysis cancelled');
        return;
      }
      if (err instanceof Error && err.message === 'Analysis cancelled') {
        console.log('[Veritas] Analysis cancelled');
        return;
      }

      setError(err instanceof Error ? err.message : 'Analysis failed');
      if (err instanceof Error && err.message.includes('sign in')) {
        setAuthState('unauthenticated');
      }
    } finally {
      setAnalyzing(false);
      abortControllerRef.current = null;
    }
  };

  // Check for cached results when URL changes
  useEffect(() => {
    if (!currentUrl) return;

    console.log('[Veritas] Checking cache for URL:', currentUrl);

    chrome.storage.local.get(currentUrl, (items) => {
      if (chrome.runtime.lastError) {
        console.error('[Veritas] Cache read error:', chrome.runtime.lastError);
        return;
      }

      if (items[currentUrl]) {
        console.log('[Veritas] Found cached result for', currentUrl);
        const cachedResult = items[currentUrl] as AnalysisResult;

        // Only set result if not currently analyzing
        if (!analyzing) {
          setResult(cachedResult);
          setError(null);

          // Send highlights for cached results (non-blocking)
          if (cachedResult.flagged_snippets && cachedResult.flagged_snippets.length > 0) {
            setTimeout(async () => {
              try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab.id) {
                  await chrome.tabs.sendMessage(tab.id, {
                    action: 'HIGHLIGHT_SNIPPETS',
                    snippets: cachedResult.flagged_snippets
                  });
                  console.log('[Veritas] Sent cached highlights to content script');
                }
              } catch (error) {
                console.error('[Veritas] Failed to send cached highlights:', error);
              }
            }, 200);
          }
        }
      } else {
        console.log('[Veritas] No cached result for', currentUrl);
        // Clear results if no cache found for this URL
        if (!analyzing) {
          setResult(null);
          setError(null);
        }
      }
    });
  }, [currentUrl, analyzing]);

  const getBiasStyle = (bias: string) => {
    const lowerBias = (bias || '').toLowerCase();
    if (lowerBias.includes('left')) {
      return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' };
    } else if (lowerBias.includes('right')) {
      return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' };
    } else {
      return { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' };
    }
  };

  // Loading state
  if (authState === 'loading') {
    return (
      <div className="w-full h-full bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  // Unauthenticated state
  if (authState === 'unauthenticated') {
    return (
      <div className="w-full h-full bg-gradient-to-b from-slate-900 to-slate-950 p-6 flex flex-col overflow-auto">
        <header className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Veritas</h1>
          <p className="text-sm text-gray-400">AI-Powered Misinformation Detection</p>
        </header>

        <div className="flex-1 flex flex-col justify-center">
          <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
            <p className="text-gray-300 text-center mb-6">
              Sign in to analyze articles for misinformation and bias.
            </p>
            <button
              onClick={handleLogin}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-[0.98]"
            >
              Sign In to Continue
            </button>
            <button
              onClick={checkAuth}
              className="w-full mt-3 py-2 px-4 text-sm text-gray-400 hover:text-white bg-transparent hover:bg-slate-700/50 rounded-lg transition-all duration-200"
            >
              Already signed in? Click to refresh
            </button>
          </div>
        </div>

        <footer className="text-center text-xs text-gray-500 mt-6">
          Powered by machine learning
        </footer>
      </div>
    );
  }

  // Authenticated state
  return (
    <div className="w-full h-full bg-gradient-to-b from-slate-900 to-slate-950 p-5 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between mb-5">
        <button
          onClick={() => chrome.tabs.create({ url: API_BASE_URL })}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="text-white font-semibold">Veritas</span>
        </button>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-800"
        >
          Sign Out
        </button>
      </header>

      {/* User welcome - only show when no result and not analyzing */}
      {!result && !analyzing && !error && (
        <div className="mb-4 px-3 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Welcome, {userName}</span>
          </div>
        </div>
      )}

      {/* Current page - only show when no result and not analyzing */}
      {currentUrl && !result && !analyzing && !error && (
        <div className="mb-5 px-3 py-2 bg-slate-800/50 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Analyzing page:</p>
          <p className="text-xs text-gray-300 truncate">{currentUrl}</p>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-y-auto min-h-0">
        {!result && !analyzing && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <button
              onClick={() => handleAnalyze(true)}
              disabled={analyzing}
              className="w-full py-4 px-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>Scan for Misinformation</span>
              </div>
            </button>
            <p className="text-xs text-gray-500 mt-4 text-center">
              Click to analyze the current page for potential misinformation and bias
            </p>
          </div>
        )}

        {analyzing && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-fade-in">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-indigo-500/20 rounded-full" />
              <div className="absolute inset-0 w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-white font-medium animate-pulse">Analyzing Content</p>
              <p className="text-sm text-gray-400 mt-1">Checking for misinformation...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={() => handleAnalyze(true)}
              className="mt-3 text-sm text-red-400 hover:text-red-300 underline"
            >
              Try again
            </button>
          </div>
        )}

        {result && (
          <div className="flex-1 flex flex-col items-center animate-fade-in">
            {/* Trust Dial */}
            <TrustDial score={result.score} size={160} />

            {/* Bias indicator */}
            <div className="mt-6 w-full">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Detected Bias</p>
              <div
                className={`px-4 py-3 rounded-xl border ${getBiasStyle(result.bias).bg} ${getBiasStyle(result.bias).border}`}
              >
                <span className={`font-medium capitalize ${getBiasStyle(result.bias).text}`}>
                  {result.bias || 'Neutral'}
                </span>
              </div>
            </div>

            {/* Flagged Content */}
            <FlaggedContent
              snippets={result.flagged_snippets}
              snippetRefs={snippetRefs}
              selectedSnippetIndex={selectedSnippetIndex}
              onSnippetSelect={setSelectedSnippetIndex}
            />

            {/* Info about score */}
            <div className="mt-6 w-full bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
              <p className="text-xs text-gray-400 leading-relaxed">
                <span className="font-medium text-gray-300">Score Interpretation:</span> A score of 100 indicates the content is highly trustworthy, while 0 indicates high likelihood of misinformation.
              </p>
            </div>

            {/* Debug Info: Model Source */}
            {result.metadata && (result.metadata.model || result.metadata.source) && (
               <div className="mt-2 text-[10px] text-gray-600 font-mono text-center w-full">
                 Analysis by: {result.metadata.model || result.metadata.source || 'Unknown'}
               </div>
            )}
          </div>
        )}
      </div>

      {/* Rescan button - Always visible at bottom */}
      {(result || error) && (
        <div className="flex-shrink-0 mt-4 p-4 border-t border-slate-700/50 bg-slate-900/50">
          <button
            onClick={() => handleAnalyze(true)} // Pass true for forceRefresh to bypass cache
            disabled={analyzing}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Rescan Page</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
