import { useState, forwardRef } from 'react';

export interface FlaggedSnippet {
  text: string;
  type?: string;
  index?: number[];
  reason: string;
  confidence?: number;
  severity?: 'low' | 'medium' | 'high';
}

interface FlaggedContentProps {
  snippets: FlaggedSnippet[];
  snippetRefs?: React.MutableRefObject<(HTMLDivElement | null)[]>;
  selectedSnippetIndex?: number | null;
}

export const FlaggedContent = ({ snippets, snippetRefs, selectedSnippetIndex }: FlaggedContentProps) => {
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

  const handleSnippetClick = async (index: number) => {
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
      <div className="flex flex-col gap-3">
        {snippets.map((snippet, idx) => (
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

    const getColors = (type: string = '') => {
      const t = type.toLowerCase();
      if (t.includes('misinformation')) return 'bg-red-500/10 border-red-500/30 text-red-400';
      if (t.includes('disinformation')) return 'bg-rose-900/20 border-rose-700/30 text-rose-400';
      if (t.includes('propaganda')) return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
      if (t.includes('fallacy')) return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      return 'bg-slate-700/30 border-slate-600/30 text-gray-300';
    };

    const colors = getColors(snippet.type);

    const handleClick = (e: React.MouseEvent) => {
      // If clicking on the expand button area, toggle expansion
      const target = e.target as HTMLElement;
      if (target.closest('.expand-button')) {
        setExpanded(!expanded);
      } else {
        // Otherwise, scroll to the snippet on the page
        onSnippetClick(index);
      }
    };

    return (
      <div
        ref={ref}
        className={`rounded-xl border transition-all duration-200 overflow-hidden ${colors} cursor-pointer hover:brightness-110 active:scale-[0.98] ${isSelected ? 'ring-2 ring-white/30' : ''}`}
        onClick={handleClick}
      >
      <div className="p-3 flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wide opacity-80">
              {snippet.type || 'Suspicious Content'}
            </span>
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
          <p className="text-[10px] opacity-60 mt-1">Click to jump to location on page</p>
        </div>
        <button
          className="expand-button flex-shrink-0"
          onClick={() => setExpanded(!expanded)}
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
          <p className="mb-1 font-semibold text-xs opacity-70 uppercase">Analysis:</p>
          <p>{snippet.reason}</p>
        </div>
      )}
    </div>
  );
});

SnippetItem.displayName = 'SnippetItem';
