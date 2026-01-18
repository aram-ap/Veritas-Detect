import type { FlaggedSnippet } from './FlaggedContent';

interface LoadingAnalysisProps {
  progress: number;
  statusMessage: string;
  partialTrustScore?: number;
  partialLabel?: string;
  partialBias?: string;
  streamingSnippets: FlaggedSnippet[];
  onCancel: () => void;
}

/**
 * Get user-friendly status message based on progress
 */
function getStatusMessage(progress: number, backendMessage?: string): string {
  if (backendMessage) return backendMessage;

  if (progress < 10) return 'Initializing analysis...';
  if (progress < 20) return 'Preparing AI models...';
  if (progress < 30) return 'Detecting bias...';
  if (progress < 50) return 'Analyzing for misinformation...';
  if (progress < 60) return 'Identifying suspicious content...';
  if (progress < 80) return 'Fact-checking claims...';
  if (progress < 90) return 'Verifying sources...';
  return 'Finalizing analysis...';
}

/**
 * Streaming loading component with detailed progress indication
 */
export const LoadingAnalysis = ({
  progress,
  statusMessage,
  partialTrustScore,
  partialLabel,
  partialBias,
  streamingSnippets,
  onCancel,
}: LoadingAnalysisProps) => {
  const displayMessage = getStatusMessage(progress, statusMessage);
  const circumference = 2 * Math.PI * 36; // radius = 36
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-fade-in py-8">
      {/* Progress Ring */}
      <div className="relative">
        {/* Background circle */}
        <svg className="w-24 h-24 transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="36"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-indigo-500/20"
          />
          {/* Progress circle */}
          <circle
            cx="48"
            cy="48"
            r="36"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="text-indigo-500 transition-all duration-500 ease-out"
            strokeLinecap="round"
          />
        </svg>
        {/* Progress percentage */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-white">
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      {/* Status Message */}
      <div className="text-center max-w-xs">
        <p className="text-white font-medium animate-pulse">{displayMessage}</p>
        <p className="text-sm text-gray-400 mt-1">This may take a moment...</p>
      </div>

      {/* Partial Trust Score (if available) */}
      {partialTrustScore !== undefined && (
        <div className="w-full max-w-xs animate-fade-in">
          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-indigo-300 uppercase tracking-wide font-semibold">
                Preliminary Score
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200">
                In Progress
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">
                {Math.round(partialTrustScore)}
              </span>
              <span className="text-sm text-gray-400">/ 100</span>
            </div>
            {partialLabel && (
              <p className="text-xs text-gray-300 mt-1 capitalize">
                {partialLabel.replace('_', ' ')}
              </p>
            )}
            {partialBias && partialBias !== 'unknown' && (
              <p className="text-xs text-gray-400 mt-1">
                Bias: <span className="capitalize">{partialBias}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Streaming Snippets */}
      {streamingSnippets.length > 0 && (
        <div className="w-full max-w-xs animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              Issues Found
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-300">
              {streamingSnippets.length} {streamingSnippets.length === 1 ? 'issue' : 'issues'}
            </span>
          </div>
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
            {streamingSnippets.map((snippet, idx) => (
              <StreamingSnippetPreview key={idx} snippet={snippet} index={idx} />
            ))}
          </div>
        </div>
      )}

      {/* Cancel Button */}
      <button
        onClick={onCancel}
        className="mt-2 px-6 py-2.5 text-sm font-medium text-white bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-all hover:scale-105 active:scale-95"
      >
        Cancel Analysis
      </button>
    </div>
  );
};

/**
 * Mini preview of streaming snippet
 */
const StreamingSnippetPreview = ({
  snippet,
  index,
}: {
  snippet: FlaggedSnippet;
  index: number;
}) => {
  const getTypeColor = (type?: string) => {
    const t = type?.toLowerCase() || '';
    if (t.includes('misinformation')) return 'border-red-500/40 bg-red-500/10 text-red-300';
    if (t.includes('propaganda')) return 'border-orange-500/40 bg-orange-500/10 text-orange-300';
    if (t.includes('fallacy')) return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
    return 'border-slate-500/40 bg-slate-700/10 text-gray-300';
  };

  return (
    <div
      className={`p-2.5 rounded-lg border transition-all duration-300 animate-slide-in-up ${getTypeColor(
        snippet.type
      )}`}
      style={{
        animationDelay: `${index * 100}ms`,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">
          {snippet.type || 'Suspicious'}
        </span>
        {snippet.is_quote && (
          <span className="text-[9px] px-1 py-0.5 rounded-full bg-blue-500/30 border border-blue-400/30">
            QUOTE
          </span>
        )}
      </div>
      <p className="text-xs leading-snug line-clamp-2 opacity-90">
        "{snippet.text}"
      </p>
    </div>
  );
};

// Add keyframe animation for slide-in effect
const style = document.createElement('style');
style.textContent = `
  @keyframes slide-in-up {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-slide-in-up {
    animation: slide-in-up 0.3s ease-out forwards;
  }
`;
document.head.appendChild(style);
