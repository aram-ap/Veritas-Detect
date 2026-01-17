import { auth0 } from "@/lib/auth0";
import Link from "next/link";

export default async function Home() {
  const session = await auth0.getSession();
  const user = session?.user;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">Veritas</span>
          </div>

          {user ? (
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
          ) : (
            <a
              href="/api/auth/login"
              className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-lg transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
            >
              Sign In
            </a>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-24">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 rounded-full border border-indigo-500/20 mb-6">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm text-indigo-400 font-medium">AI-Powered Analysis</span>
            </div>

            <h1 className="text-5xl sm:text-6xl font-bold text-white mb-6 leading-tight">
              Detect{" "}
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Misinformation
              </span>
              <br />
              in Real-Time
            </h1>

            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
              Veritas uses advanced machine learning to analyze web articles for misinformation,
              political bias, and factual errors. Get instant trust scores as you browse.
            </p>

            {user ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <div className="px-6 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <span className="text-emerald-400 font-medium">You&apos;re signed in and ready to use the extension</span>
                </div>
                <Link
                  href="#how-it-works"
                  className="px-6 py-3 text-gray-300 hover:text-white transition-colors"
                >
                  Learn More
                </Link>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="/api/auth/login"
                  className="px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-xl transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105"
                >
                  Get Started Free
                </a>
                <Link
                  href="#how-it-works"
                  className="px-8 py-4 text-lg font-medium text-gray-300 hover:text-white transition-colors"
                >
                  Learn More
                </Link>
              </div>
            )}
          </div>

          {/* Feature Cards */}
          <div id="how-it-works" className="grid md:grid-cols-3 gap-6 mt-20">
            <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50 hover:border-indigo-500/30 transition-colors">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Browser Extension</h3>
              <p className="text-gray-400 leading-relaxed">
                Install our Chrome extension to analyze any article as you browse. Get instant trust scores in your sidebar.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50 hover:border-purple-500/30 transition-colors">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">ML-Powered Analysis</h3>
              <p className="text-gray-400 leading-relaxed">
                Our machine learning models are trained on 79,000+ articles to detect patterns of misinformation and bias.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50 hover:border-emerald-500/30 transition-colors">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Trust Scores</h3>
              <p className="text-gray-400 leading-relaxed">
                Get clear 0-100 trust scores with bias indicators. Higher scores mean more trustworthy content.
              </p>
            </div>
          </div>

          {/* How It Works Section */}
          <div className="mt-32">
            <h2 className="text-3xl font-bold text-white text-center mb-4">How It Works</h2>
            <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
              Three simple steps to start verifying the information you read online.
            </p>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-indigo-500/25">
                  1
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Sign In</h3>
                <p className="text-gray-400">Create a free account to access the Veritas analysis service.</p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-indigo-500/25">
                  2
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Install Extension</h3>
                <p className="text-gray-400">Add the Veritas extension to your Chrome browser.</p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-indigo-500/25">
                  3
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Analyze</h3>
                <p className="text-gray-400">Click the extension while reading any article to get instant analysis.</p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          {!user && (
            <div className="mt-32 text-center bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 rounded-3xl p-12 border border-indigo-500/20">
              <h2 className="text-3xl font-bold text-white mb-4">Ready to Fight Misinformation?</h2>
              <p className="text-gray-400 mb-8 max-w-xl mx-auto">
                Join thousands of users who are making more informed decisions with Veritas.
              </p>
              <a
                href="/api/auth/login"
                className="inline-flex px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-xl transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
              >
                Get Started for Free
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="border-t border-slate-800 mt-20">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-400">Veritas</span>
              </div>
              <p className="text-sm text-gray-500">
                Built with ML to fight misinformation
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
