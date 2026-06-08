'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ClipPostResult, ClipWithProxy, TikTokAccount } from '@/lib/types'

type PostResult = ClipPostResult & { tiktokStatus?: string; failReason?: string; checking?: boolean }

// ─── Clip card ────────────────────────────────────────────────────────────────

function ClipCard({
  clip, selected, onToggle,
}: {
  clip: ClipWithProxy
  selected: boolean
  onToggle: () => void
}) {
  return (
    <div className={`bg-gray-900 rounded-xl overflow-hidden border transition-colors ${
      selected ? 'border-white' : 'border-gray-800'
    }`}>
      <div className="relative aspect-[9/16] bg-gray-800">
        <video src={clip.proxy_url} controls preload="metadata" className="w-full h-full object-cover" />
        <button
          onClick={onToggle}
          className={`absolute top-2 left-2 w-5 h-5 rounded border flex items-center justify-center transition-colors pointer-events-auto ${
            selected ? 'bg-white border-white' : 'bg-black/50 border-white/30'
          }`}
        >
          {selected && (
            <svg className="w-3 h-3 text-gray-950" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        {clip.status !== 'ready' && (
          <span className={`absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded ${
            clip.status === 'posted' ? 'bg-white text-gray-950' : 'bg-red-900 text-red-200'
          }`}>
            {clip.status === 'posted' ? 'Sent' : 'Failed'}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs text-gray-400 truncate">{clip.filename}</p>
        {clip.caption && <p className="text-sm text-gray-200 leading-snug line-clamp-2 mt-1">{clip.caption}</p>}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClipsPage() {
  const [clips, setClips] = useState<ClipWithProxy[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [posting, setPosting] = useState(false)
  const [results, setResults] = useState<PostResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeAccount, setActiveAccount] = useState<TikTokAccount | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/clips').then(r => r.json())
      setClips(res.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/auth/tiktok/accounts')
      .then(r => r.json())
      .then(j => {
        const all: TikTokAccount[] = j.accounts ?? []
        setActiveAccount(all.find(a => a.id === j.activeAccountId) ?? null)
      })
      .catch(() => {})
  }, [])

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedArray = Array.from(selectedIds)

  async function postSelected() {
    if (!selectedArray.length) return
    setPosting(true)
    setResults(null)
    setError(null)
    try {
      const res = await fetch('/api/clips/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipIds: selectedArray }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const data: PostResult[] = (json.data ?? []).map((r: ClipPostResult) => ({
        ...r,
        checking: r.success && !!r.publish_id,
      }))
      setResults(data)
      await load()
      setSelectedIds(new Set())

      // Wait 4s for TikTok to process, then check actual status for each clip
      const toCheck = data.filter(r => r.success && r.publish_id)
      if (toCheck.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 4000))
        const updated = await Promise.all(
          data.map(async r => {
            if (!r.success || !r.publish_id) return r
            try {
              const s = await fetch(`/api/posts/status?publish_id=${r.publish_id}`).then(x => x.json())
              return { ...r, checking: false, tiktokStatus: s.data?.status, failReason: s.data?.fail_reason }
            } catch {
              return { ...r, checking: false }
            }
          })
        )
        setResults(updated)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Posting failed')
    } finally {
      setPosting(false)
    }
  }

  const allSelected = clips.length > 0 && clips.every(c => selectedIds.has(c.id))

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-800">
        <h1 className="text-xl font-semibold">Clips</h1>
        <div className="flex items-center gap-3">
          {clips.length > 0 && (
            <button
              onClick={() => setSelectedIds(allSelected ? new Set() : new Set(clips.map(c => c.id)))}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          )}
          {selectedArray.length > 0 && (
            <div className="flex items-center gap-2">
              {activeAccount && (
                <span className="text-xs text-gray-500">
                  as <span className="text-gray-200">{activeAccount.display_name ?? `TikTok #${activeAccount.open_id.slice(-6)}`}</span>
                </span>
              )}
              {!activeAccount && (
                <a href="/api/auth/tiktok" className="text-xs text-gray-300 hover:underline">Connect TikTok first</a>
              )}
              <button
                onClick={postSelected}
                disabled={posting || !activeAccount}
                className="px-4 py-1.5 text-sm bg-white text-gray-950 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                {posting ? 'Posting...' : `Post Selected (${selectedArray.length})`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {results && (
        <div className="mx-6 mt-4 p-4 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-sm font-medium mb-3">Results:</p>
          <div className="space-y-1.5">
            {results.map(r => {
              const failed = r.tiktokStatus === 'FAILED'
              const sent = r.tiktokStatus === 'PUBLISHED_PUBLIC' || r.tiktokStatus === 'PUBLISHED_PRIVATE' || r.tiktokStatus === 'IN_REVIEW'
              const icon = !r.success ? '✗' : r.checking ? '…' : failed ? '✗' : '✓'
              const color = !r.success || failed ? 'text-red-400' : r.checking ? 'text-gray-500' : 'text-gray-200'
              let msg = ''
              if (!r.success) msg = r.error ?? 'Failed'
              else if (r.checking) msg = 'Sent — checking TikTok status...'
              else if (failed) msg = `Did not go through — ${r.failReason ?? 'TikTok rejected it'}`
              else if (sent) msg = 'Sent to inbox ✓'
              else if (r.tiktokStatus) msg = `Sent — status: ${r.tiktokStatus}`
              else msg = 'Sent'
              return (
                <div key={r.clipId} className="flex items-center gap-2 text-sm">
                  <span className={color}>{icon}</span>
                  <span className="text-gray-400">{msg}</span>
                </div>
              )
            })}
          </div>
          <button onClick={() => setResults(null)} className="mt-3 text-xs text-gray-500 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-900/30 border border-red-800 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Grid */}
      <div className="px-6 py-6">
        {loading ? (
          <p className="text-gray-600 text-sm">Loading...</p>
        ) : clips.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-gray-500">No clips yet — finish some in the local ClipR pipeline and send them here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {clips.map(clip => (
              <ClipCard
                key={clip.id}
                clip={clip}
                selected={selectedIds.has(clip.id)}
                onToggle={() => toggleSelect(clip.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
