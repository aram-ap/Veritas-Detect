"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Link from "next/link";

interface UserStats {
  joinedAt: string;
  totalAnalyses: number;
  misinformationDetected: number;
  tagFrequencies: Record<string, number>;
  recentAnalyses: Array<{
    id: string;
    title: string | null;
    url: string | null;
    trustScore: number;
    hasMisinformation: boolean;
    analyzedAt: string;
  }>;
}

export default function Dashboard() {
  const { user, isLoading } = useUser();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      fetchStats();
    }
  }, [user, isLoading]);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError('Failed to load statistics');
      console.error(err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to clear all your analysis history? This cannot be undone.')) {
      return;
    }

    setClearing(true);
    try {
      const response = await fetch('/api/history/clear', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to clear history');
      }

      // Refresh stats to show empty state
      await fetchStats();
      alert('History cleared successfully!');
    } catch (err) {
      alert('Failed to clear history. Please try again.');
      console.error(err);
    } finally {
      setClearing(false);
    }
  };

  if (isLoading || loadingStats) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Please sign in to view your dashboard</h1>
          <a
            href="/api/auth/login"
            className="px-6 py-3 text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-lg transition-all"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  // Prepare chart data
  const chartData = stats
    ? Object.entries(stats.tagFrequencies)
        .map(([tag, count]) => ({
          tag: tag.length > 20 ? tag.substring(0, 20) + '...' : tag,
          count,
          fullTag: tag
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10) // Top 10 tags
    : [];

  const joinedDate = stats ? new Date(stats.joinedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">Veritas</span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {user.picture && (
                <img
                  src={user.picture}
                  alt={user.name || 'Profile'}
                  className="w-8 h-8 rounded-full border-2 border-indigo-500/50"
                />
              )}
              <span className="text-sm text-gray-300 hidden sm:block">{user.name || user.email}</span>
            </div>
            <a
              href="/api/auth/logout"
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Sign Out
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Your Dashboard</h1>
            <p className="text-gray-400">Track your article analysis history and statistics</p>
          </div>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-gray-400 text-sm font-medium">Member Since</h3>
              </div>
              <p className="text-2xl font-bold text-white">{joinedDate}</p>
            </div>

            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-gray-400 text-sm font-medium">Articles Analyzed</h3>
              </div>
              <p className="text-2xl font-bold text-white">{stats?.totalAnalyses || 0}</p>
            </div>

            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500/20 to-red-600/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-gray-400 text-sm font-medium">Misinformation Detected</h3>
              </div>
              <p className="text-2xl font-bold text-white">{stats?.misinformationDetected || 0}</p>
            </div>
          </div>

          {/* Bar Chart */}
          {chartData.length > 0 && (
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 mb-8">
              <h2 className="text-xl font-semibold text-white mb-6">Top Flagged Tags</h2>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="tag" 
                    stroke="#94a3b8"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    labelFormatter={(value) => {
                      const item = chartData.find(d => d.tag === value);
                      return item?.fullTag || value;
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="count" 
                    fill="#8b5cf6" 
                    name="Frequency"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Recent Analyses */}
          {stats && stats.recentAnalyses.length > 0 && (
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Recent Analyses</h2>
                <button
                  onClick={handleClearHistory}
                  disabled={clearing}
                  className="px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {clearing ? 'Clearing...' : 'Clear History'}
                </button>
              </div>
              <div className="space-y-4">
                {stats.recentAnalyses.map((analysis) => (
                  <div 
                    key={analysis.id}
                    className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-white font-medium mb-1">
                          {analysis.title || 'Untitled Article'}
                        </h3>
                        {analysis.url && (
                          <a 
                            href={analysis.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-indigo-400 hover:text-indigo-300 truncate block"
                          >
                            {analysis.url}
                          </a>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(analysis.analyzedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className={`px-3 py-1 rounded-lg text-sm font-medium ${
                          analysis.trustScore >= 70 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : analysis.trustScore >= 50
                            ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          Score: {analysis.trustScore.toFixed(0)}
                        </div>
                        {analysis.hasMisinformation && (
                          <span className="text-xs text-red-400">
                            ⚠️ Misinformation
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {stats && stats.totalAnalyses === 0 && (
            <div className="bg-slate-800/50 rounded-2xl p-12 border border-slate-700/50 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No Analyses Yet</h3>
              <p className="text-gray-400 mb-6">
                Install the Veritas browser extension and start analyzing articles to see your statistics here.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
