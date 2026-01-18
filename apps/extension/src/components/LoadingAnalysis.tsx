import { useState, useEffect } from 'react';
import type { FlaggedSnippet } from './FlaggedContent';

interface LoadingAnalysisProps {
  progress: number;
  statusMessage: string;
  streamingSnippets: FlaggedSnippet[];
  onCancel: () => void;
}

/**
 * Truncate text to a certain length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Streaming loading component with detailed progress indication
 */
export const LoadingAnalysis = ({
  progress,
  statusMessage,
  streamingSnippets,
  onCancel,
}: LoadingAnalysisProps) => {
  const [displayedMessages, setDisplayedMessages] = useState<string[]>([]);
  const [animatedProgress, setAnimatedProgress] = useState(0);

  // Smooth progress animation
  useEffect(() => {
    const diff = progress - animatedProgress;
    if (Math.abs(diff) < 0.1) {
      setAnimatedProgress(progress);
      return;
    }

    const increment = diff * 0.1; // Ease out
    const timer = setTimeout(() => {
      setAnimatedProgress(prev => prev + increment);
    }, 16); // ~60fps

    return () => clearTimeout(timer);
  }, [progress, animatedProgress]);

  // Add new status messages to the log
  useEffect(() => {
    if (statusMessage && statusMessage.trim()) {
      setDisplayedMessages(prev => {
        // Don't add duplicates
        if (prev[prev.length - 1] === statusMessage) return prev;
        // Keep last 3 messages
        const newMessages = [...prev, statusMessage];
        return newMessages.slice(-3);
      });
    }
  }, [statusMessage]);

  // Add snippet detection messages
  useEffect(() => {
    if (streamingSnippets.length > 0) {
      const latestSnippet = streamingSnippets[streamingSnippets.length - 1];
      const snippetPreview = truncateText(latestSnippet.text, 40);
      const message = `Found: "${snippetPreview}"`;

      setDisplayedMessages(prev => {
        if (prev[prev.length - 1] === message) return prev;
        const newMessages = [...prev, message];
        return newMessages.slice(-3);
      });
    }
  }, [streamingSnippets.length]);

  const circumference = 2 * Math.PI * 40; // radius = 40
  const strokeDashoffset = circumference - (animatedProgress / 100) * circumference;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-fade-in py-8">
      {/* Animated Progress Ring */}
      <div className="relative">
        {/* Pulsing glow effect */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-32 rounded-full bg-indigo-500/20 blur-2xl animate-pulse" />
        </div>

        {/* Rotating gradient background */}
        <div className="absolute inset-0 flex items-center justify-center animate-spin-slow">
          <div className="w-28 h-28 rounded-full bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-pink-500/30 blur-md" />
        </div>

        {/* Progress ring */}
        <svg className="w-28 h-28 transform -rotate-90 relative z-10">
          {/* Background circle */}
          <circle
            cx="56"
            cy="56"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-indigo-500/10"
          />
          {/* Animated progress circle */}
          <circle
            cx="56"
            cy="56"
            r="40"
            stroke="url(#gradient)"
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-300 ease-out"
            strokeLinecap="round"
            style={{
              filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.6))',
            }}
          />
          {/* Gradient definition */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
        </svg>

        {/* Progress percentage */}
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <span className="text-2xl font-bold text-white tabular-nums">
            {Math.round(animatedProgress)}%
          </span>
        </div>
      </div>

      {/* Activity Log */}
      <div className="w-full max-w-sm">
        <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 min-h-[100px]">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Activity</p>
          <div className="space-y-2">
            {displayedMessages.length === 0 ? (
              <div className="text-sm text-gray-400 italic">Initializing analysis...</div>
            ) : (
              displayedMessages.map((message, idx) => (
                <div
                  key={`${message}-${idx}`}
                  className="text-sm text-gray-300 animate-slide-in-left flex items-start gap-2"
                  style={{
                    animationDelay: `${idx * 50}ms`,
                  }}
                >
                  <svg
                    className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5 animate-pulse"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="flex-1">{message}</span>
                </div>
              ))
            )}
          </div>
          {streamingSnippets.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-700/50">
              <p className="text-xs text-amber-400">
                {streamingSnippets.length} {streamingSnippets.length === 1 ? 'issue' : 'issues'} detected
              </p>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">This may take a moment...</p>
      </div>

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

// Add keyframe animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slide-in-left {
    from {
      opacity: 0;
      transform: translateX(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes spin-slow {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .animate-slide-in-left {
    animation: slide-in-left 0.4s ease-out forwards;
  }

  .animate-spin-slow {
    animation: spin-slow 8s linear infinite;
  }
`;
document.head.appendChild(style);
