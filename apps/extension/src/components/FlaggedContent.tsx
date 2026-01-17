import { useState } from 'react';

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
}

export const FlaggedContent = ({ snippets }: FlaggedContentProps) => {
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

  return (
    <div className="mt-6 w-full">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Flagged Content</p>
      <div className="flex flex-col gap-3">
        {snippets.map((snippet, idx) => (
          <SnippetItem key={idx} snippet={snippet} />
        ))}
      </div>
    </div>
  );
};

const SnippetItem = ({ snippet }: { snippet: FlaggedSnippet }) => {
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

  return (
    <div 
      className={`rounded-xl border transition-all duration-200 overflow-hidden ${colors} cursor-pointer`}
      onClick={() => setExpanded(!expanded)}
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
          </div>
          <p className="text-sm font-medium leading-snug line-clamp-2">
            "{snippet.text}"
          </p>
        </div>
        <div className={`transform transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
          <svg className="w-5 h-5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      {expanded && (
        <div className="px-3 pb-3 pt-0 text-sm opacity-90 border-t border-black/10 mt-1 pt-2">
          <p className="mb-1 font-semibold text-xs opacity-70 uppercase">Analysis:</p>
          <p>{snippet.reason}</p>
        </div>
      )}
    </div>
  );
};
