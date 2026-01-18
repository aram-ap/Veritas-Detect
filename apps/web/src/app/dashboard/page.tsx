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
    bias: string;
    analyzedAt: string;
  }>;
}

interface UsageData {
  tier: string;
  dailyLimit: number;
  used: number;
  remaining: number;
  subscriptionEndsAt: string | null;
}

export default function Dashboard() {
  const { user, isLoading } = useUser();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      fetchStats();
      fetchUsage();
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

  const fetchUsage = async () => {
    try {
      const response = await fetch('/api/usage');
      if (!response.ok) {
        throw new Error('Failed to fetch usage');
      }
      const data = await response.json();
      setUsage(data);
    } catch (err) {
      console.error('Failed to load usage:', err);
    }
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.url;
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to start checkout');
      }
    } catch (err) {
      alert('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setUpgrading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const response = await fetch('/api/billing-portal', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.url;
      } else {
        alert('Failed to open billing portal');
      }
    } catch (err) {
      alert('An error occurred. Please try again.');
      console.error(err);
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
            <Link
              href="/beta"
              className="px-4 py-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors hidden sm:block"
            >
              Beta User
            </Link>
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

          {/* Subscription Card */}
          {usage && (
            <div className="bg-gradient-to-br from-indigo-500/10 to-purple-600/10 rounded-2xl p-6 border border-indigo-500/20 mb-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white capitalize">
                        {usage.tier === 'unlimited' ? 'Unlimited' : usage.tier === 'beta' ? 'Beta User' : usage.tier === 'pro' ? 'Pro' : 'Free'} Tier
                      </h2>
                      {usage.subscriptionEndsAt && (
                        <p className="text-sm text-gray-400">
                          Expires: {new Date(usage.subscriptionEndsAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-300">Daily Usage</span>
                      <span className="text-sm font-medium text-white">
                        {usage.dailyLimit === -1 ? 'Unlimited' : `${usage.used} / ${usage.dailyLimit}`}
                      </span>
                    </div>
                    {usage.dailyLimit !== -1 && (
                      <div className="w-full bg-slate-700/50 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (usage.used / usage.dailyLimit) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {usage.dailyLimit === -1 
                      ? 'No daily limits' 
                      : `${usage.remaining} analyses remaining today`
                    }
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {usage.tier === 'free' && (
                    <>
                      <button
                        onClick={handleUpgrade}
                        disabled={upgrading}
                        className="px-6 py-3 text-white font-medium bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {upgrading ? 'Loading...' : 'Upgrade to Pro'}
                      </button>
                      <Link
                        href="/beta"
                        className="px-6 py-3 text-center text-indigo-400 font-medium border border-indigo-500/30 hover:border-indigo-500/50 hover:bg-indigo-500/5 rounded-lg transition-all whitespace-nowrap"
                      >
                        Beta Code
                      </Link>
                    </>
                  )}
                  {usage.tier === 'beta' && (
                    <button
                      onClick={handleUpgrade}
                      disabled={upgrading}
                      className="px-6 py-3 text-white font-medium bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {upgrading ? 'Loading...' : 'Upgrade to Pro'}
                    </button>
                  )}
                  {usage.tier === 'pro' && (
                    <button
                      onClick={handleManageBilling}
                      className="px-6 py-3 text-gray-300 font-medium border border-slate-600 hover:border-slate-500 hover:bg-slate-700/50 rounded-lg transition-all whitespace-nowrap"
                    >
                      Manage Billing
                    </button>
                  )}
                </div>
              </div>

              {/* Tier Comparison */}
              {usage.tier === 'free' && (
                <div className="mt-6 pt-6 border-t border-slate-700/50">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Compare Plans</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400 mb-1">Free</div>
                      <div className="text-white font-medium">5/day</div>
                    </div>
                    <div>
                      <div className="text-gray-400 mb-1">Beta</div>
                      <div className="text-white font-medium">20/day</div>
                    </div>
                    <div>
                      <div className="text-indigo-400 mb-1">Pro</div>
                      <div className="text-white font-medium">50/day</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
                {stats.recentAnalyses.map((analysis) => {
                  // Determine bias badge styling
                  const getBiasBadge = (bias: string) => {
                    const biasLower = bias.toLowerCase();
                    if (biasLower === 'left') {
                      return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
                    } else if (biasLower === 'right') {
                      return 'bg-red-500/10 text-red-400 border border-red-500/20';
                    } else if (biasLower === 'center') {
                      return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
                    } else {
                      return 'bg-gray-500/10 text-gray-400 border border-gray-500/20';
                    }
                  };

                  return (
                    <div 
                      key={analysis.id}
                      className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium mb-1">
                            {analysis.title || 'Untitled Article'}
                          </h3>
                          {analysis.url && (
                            <a 
                              href={analysis.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-indigo-400 hover:text-indigo-300 block overflow-hidden text-ellipsis whitespace-nowrap"
                              title={analysis.url}
                            >
                              {analysis.url}
                            </a>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(analysis.analyzedAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <div className={`px-3 py-1 rounded-lg text-sm font-medium whitespace-nowrap ${
                            analysis.trustScore >= 70 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : analysis.trustScore >= 50
                              ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            Score: {analysis.trustScore.toFixed(0)}
                          </div>
                          <div className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${getBiasBadge(analysis.bias)}`}>
                            {analysis.bias.charAt(0).toUpperCase() + analysis.bias.slice(1)}
                          </div>
                          {analysis.hasMisinformation && (
                            <span className="text-xs text-red-400 whitespace-nowrap">
                              ⚠️ Misinformation
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
