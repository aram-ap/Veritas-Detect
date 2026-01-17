import { useMemo } from 'react';

interface TrustDialProps {
  score: number; // 0-100, where 100 is most trustworthy
  size?: number;
}

export function TrustDial({ score, size = 180 }: TrustDialProps) {
  const normalizedScore = Math.max(0, Math.min(100, score));

  const { color, label, bgGradient } = useMemo(() => {
    if (normalizedScore >= 70) {
      return {
        color: '#10b981',
        label: 'Trustworthy',
        bgGradient: 'from-emerald-500/20 to-emerald-600/20'
      };
    } else if (normalizedScore >= 40) {
      return {
        color: '#f59e0b',
        label: 'Questionable',
        bgGradient: 'from-amber-500/20 to-orange-500/20'
      };
    } else {
      return {
        color: '#ef4444',
        label: 'Unreliable',
        bgGradient: 'from-red-500/20 to-rose-600/20'
      };
    }
  }, [normalizedScore]);

  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center">
      <div
        className={`relative rounded-full bg-gradient-to-br ${bgGradient} p-2`}
        style={{ width: size + 16, height: size + 16 }}
      >
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
            style={{
              filter: `drop-shadow(0 0 8px ${color})`
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-5xl font-bold tabular-nums"
            style={{ color }}
          >
            {normalizedScore}
          </span>
          <span className="text-xs text-gray-400 uppercase tracking-wider mt-1">
            Trust Score
          </span>
        </div>
      </div>

      {/* Label below */}
      <div
        className="mt-4 px-4 py-1.5 rounded-full text-sm font-semibold"
        style={{
          backgroundColor: `${color}20`,
          color: color
        }}
      >
        {label}
      </div>
    </div>
  );
}
