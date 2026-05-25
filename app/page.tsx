'use client'

import { useEffect, useState } from 'react'

export default function Home() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [authError, setAuthError] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'auth_failed') {
      setAuthError(true)
      window.history.replaceState({}, '', '/')
    }

    fetch('/api/auth-status')
      .then((r) => r.json())
      .then((d) => setConnected(d.connected))
  }, [])

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold tracking-tight">SlidePost</h1>
        <div className="flex items-center gap-3">
          {connected === null ? (
            <span className="text-sm text-gray-500">Checking...</span>
          ) : connected ? (
            <span className="flex items-center gap-1.5 text-sm text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              TikTok connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-gray-400">
              <span className="w-2 h-2 rounded-full bg-gray-500 inline-block" />
              Not connected
            </span>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-6">
        {/* Auth error */}
        {authError && (
          <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">
            TikTok authentication failed. Please try again.
          </div>
        )}

        {/* Connect TikTok */}
        {connected === false && (
          <div className="rounded-lg border border-gray-700 bg-gray-900 px-6 py-8 text-center">
            <p className="text-gray-400 mb-4 text-sm">
              Connect your TikTok account to start posting slideshows.
            </p>
            <a
              href="/api/auth/tiktok"
              className="inline-block bg-white text-black font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-gray-100 transition-colors"
            >
              Connect TikTok
            </a>
          </div>
        )}

        {/* Image Drop Zone — placeholder for Phase 2 */}
        <div className="rounded-lg border-2 border-dashed border-gray-700 bg-gray-900 px-6 py-12 text-center text-gray-500 text-sm">
          Image upload coming in Phase 2
        </div>

        {/* Caption — placeholder for Phase 2 */}
        <textarea
          disabled
          placeholder="Caption..."
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-400 placeholder-gray-600 resize-none focus:outline-none"
          rows={3}
        />

        {/* Hashtags — placeholder for Phase 2 */}
        <input
          disabled
          placeholder="Add hashtags..."
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-400 placeholder-gray-600 focus:outline-none"
        />

        {/* Post button */}
        <button
          disabled
          className="w-full bg-white text-black font-semibold py-3 rounded-lg text-sm opacity-30 cursor-not-allowed"
        >
          Post as Draft
        </button>
      </div>
    </main>
  )
}
