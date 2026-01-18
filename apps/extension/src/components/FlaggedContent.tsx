import { useState, forwardRef } from 'react';

export interface FlaggedSnippet {
  text: string;
  type?: string;
  index?: number[];
  reason: string;
  confidence?: number;
  severity?: 'low' | 'medium' | 'high';
  is_quote?: boolean;
  sources?: Array<{
    title: string;
    url: string;
    snippet: string;
    source: string;
    is_credible: boolean;
  }>;
  verification_status?: string;
  verification_confidence?: number;
}

interface FlaggedContentProps {
  snippets: FlaggedSnippet[];
  snippetRefs?: React.MutableRefObject<(HTMLDivElement | null)[]>;
  selectedSnippetIndex?: number | null;
  onSnippetSelect?: (index: number) => void;
}

export const FlaggedContent = ({ snippets, snippetRefs, selectedSnippetIndex, onSnippetSelect }: FlaggedContentProps) => {
  if (!snippets || snippets.length === 0) {
    return (
        <div className="mt-6 w-full">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Flagged Content</p>
            <div className="p-3 rounded-xl border border-dashed border-gray-700 bg-gray-800/20 text-center">
                <p className="text-sm text-gray-400">No specific misinformation flagged.</p>
            </div>
        </div>
    );
  }

  // Sort snippets by their location in the page (by index)
  const sortedSnippets = [...snippets].sort((a, b) => {
    const aIndex = a.index?.[0] ?? Infinity;
    const bIndex = b.index?.[0] ?? Infinity;
    return aIndex - bIndex;
  });

  const handleSnippetClick = async (index: number) => {
    // Update selected state in parent
    if (onSnippetSelect) {
      onSnippetSelect(index);
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) return;

      await chrome.tabs.sendMessage(tab.id, {
        action: 'SCROLL_TO_SNIPPET',
        snippetIndex: index
      });
    } catch (error) {
      console.error('[Veritas] Failed to scroll to snippet:', error);
    }
  };

  return (
    <div className="mt-6 w-full">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Flagged Content</p>
      <div className="flex flex-col gap-4">
        {sortedSnippets.map((snippet, idx) => (
          <SnippetItem
            key={idx}
            snippet={snippet}
            index={idx}
            onSnippetClick={handleSnippetClick}
            ref={(el) => {
              if (snippetRefs) {
                snippetRefs.current[idx] = el;
              }
            }}
            isSelected={selectedSnippetIndex === idx}
          />
        ))}
      </div>
    </div>
  );
};

interface SnippetItemProps {
  snippet: FlaggedSnippet;
  index: number;
  onSnippetClick: (index: number) => void;
  isSelected?: boolean;
}

const SnippetItem = forwardRef<HTMLDivElement, SnippetItemProps>(
  ({ snippet, index, onSnippetClick, isSelected }, ref) => {
    const [expanded, setExpanded] = useState(false);

    const getColors = (type: string = '', isQuote: boolean = false) => {
      const t = type.toLowerCase();

      // If it's quoted content, use blue color scheme
      if (isQuote || t.includes('quoted')) {
        if (t.includes('misinformation') || t.includes('disinformation')) {
          return 'bg-blue-500/15 border-blue-500/40 text-blue-300';
        }
        if (t.includes('propaganda')) return 'bg-sky-500/15 border-sky-500/40 text-sky-300';
        if (t.includes('fallacy')) return 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300';
        return 'bg-blue-600/15 border-blue-600/40 text-blue-200';
      }

      // Regular (non-quoted) content colors
      if (t.includes('misinformation')) return 'bg-red-500/10 border-red-500/30 text-red-400';
      if (t.includes('disinformation')) return 'bg-rose-900/20 border-rose-700/30 text-rose-400';
      if (t.includes('propaganda')) return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
      if (t.includes('fallacy')) return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      return 'bg-slate-700/30 border-slate-600/30 text-gray-300';
    };

    const colors = getColors(snippet.type, snippet.is_quote);

    const handleClick = () => {
      // Scroll to the snippet on the page (expand button handles its own clicks)
      onSnippetClick(index);
    };

    return (
      <div
        ref={ref}
        className={`rounded-xl transition-all duration-200 overflow-hidden ${colors} cursor-pointer hover:brightness-110 active:scale-[0.98] ${isSelected ? 'border-[3px] ring-2 ring-white/50 shadow-lg' : 'border'}`}
        onClick={handleClick}
      >
      <div className="p-3 flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wide opacity-80">
              {snippet.type || 'Suspicious Content'}
            </span>
            {snippet.is_quote && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/30 border border-blue-400/30 flex items-center gap-1">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/>
                </svg>
                QUOTE
              </span>
            )}
            {snippet.severity && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-black/20 uppercase`}>
                {snippet.severity}
              </span>
            )}
            {/* Location indicator */}
            <svg className="w-3.5 h-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium leading-snug line-clamp-2">
            "{snippet.text}"
          </p>
          <p className="text-[10px] opacity-60 mt-1">
            {snippet.is_quote ? 'Quoted content - ' : ''}Click to jump to location on page
          </p>
        </div>
        <button
          className="expand-button flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <div className={`transform transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
            <svg className="w-5 h-5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-0 text-sm opacity-90 border-t border-black/10 mt-1 pt-2">
          {snippet.is_quote && (
            <div className="mb-3 p-2 rounded-lg bg-blue-500/10 border border-blue-400/20">
              <p className="text-xs font-semibold opacity-80 uppercase mb-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/>
                </svg>
                Quoted Content
              </p>
              <p className="text-xs opacity-70">This is quoted content from a source, not the article's own claim. The article's trustworthiness may not be affected by quoted misinformation.</p>
            </div>
          )}

          <p className="mb-1 font-semibold text-xs opacity-70 uppercase">Analysis:</p>
          <p className="mb-3">{snippet.reason}</p>

          {/* Verification Status */}
          {snippet.verification_status && (
            <div className="mb-3 p-2 rounded-lg bg-black/20 border border-white/10">
              <p className="text-xs font-semibold opacity-70 uppercase mb-1">Verification Status:</p>
              <p className="text-xs">{snippet.verification_status}</p>
              {snippet.verification_confidence !== undefined && (
                <p className="text-xs opacity-60 mt-1">
                  Confidence: {(snippet.verification_confidence * 100).toFixed(0)}%
                </p>
              )}
            </div>
          )}

          {/* Sources */}
          {snippet.sources && snippet.sources.length > 0 ? (
            <div>
              <p className="mb-2 font-semibold text-xs opacity-70 uppercase flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Sources Found ({snippet.sources.length}):
              </p>
              <div className="space-y-2">
                {snippet.sources.map((source, idx) => (
                  <a
                    key={idx}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-2 rounded-lg bg-black/20 border border-white/10 hover:border-white/30 hover:bg-black/30 transition-all"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start gap-2">
                      {source.is_credible && (
                        <svg className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{source.title}</p>
                        <p className="text-[10px] opacity-60 truncate">{source.source || source.url}</p>
                        {source.snippet && (
                          <p className="text-[10px] opacity-70 mt-1 line-clamp-2">{source.snippet}</p>
                        )}
                      </div>
                      <svg className="w-3 h-3 opacity-40 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs opacity-50 italic">No sources found for verification.</div>
          )}
        </div>
      )}
    </div>
  );
});

SnippetItem.displayName = 'SnippetItem';
