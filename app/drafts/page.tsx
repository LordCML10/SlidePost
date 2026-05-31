'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BulkPostResult, Draft, ImageWithProxy, TikTokAccount } from '@/lib/types'

// ─── Draft card ───────────────────────────────────────────────────────────────

function DraftCard({
  draft, thumbUrl, selected, onToggle, onEdit, onDelete,
}: {
  draft: Draft
  thumbUrl: string | null
  selected: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const hashtagCount = (draft.custom_hashtags?.length ?? 0)

  return (
    <div className={`bg-gray-900 rounded-xl overflow-hidden border transition-colors ${
      selected ? 'border-violet-500' : 'border-gray-800'
    }`}>
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-800">
        {thumbUrl ? (
          <img src={thumbUrl} alt="thumbnail" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-700 text-xs">No image</div>
        )}
        <button
          onClick={onToggle}
          className={`absolute top-2 left-2 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
            selected ? 'bg-violet-600 border-violet-600' : 'bg-black/50 border-white/30'
          }`}
        >
          {selected && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        {draft.posted && (
          <span className="absolute top-2 right-2 text-[10px] bg-green-600 text-white px-1.5 py-0.5 rounded">
            Posted
          </span>
        )}
        <span className="absolute bottom-2 right-2 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
          {draft.image_ids.length} slides
        </span>
      </div>

      {/* Body */}
      <div className="p-3">
        {draft.name && (
          <p className="text-xs text-violet-400 font-medium mb-0.5 truncate">{draft.name}</p>
        )}
        <p className="text-sm text-gray-200 leading-snug line-clamp-2 mb-2">{draft.caption}</p>
        {hashtagCount > 0 && (
          <p className="text-xs text-gray-600">{hashtagCount} hashtag{hashtagCount !== 1 ? 's' : ''}</p>
        )}
        <div className="flex gap-2 mt-3">
          <button
            onClick={onEdit}
            className="flex-1 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="flex-1 py-1.5 text-xs border border-gray-800 hover:border-red-800 hover:text-red-400 rounded-md transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DraftsPage() {
  const router = useRouter()

  const [drafts, setDrafts] = useState<Draft[]>([])
  const [thumbMap, setThumbMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [posting, setPosting] = useState(false)
  const [results, setResults] = useState<BulkPostResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeAccount, setActiveAccount] = useState<TikTokAccount | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const draftsRes = await fetch('/api/drafts').then(r => r.json())
      const loaded: Draft[] = draftsRes.data ?? []
      setDrafts(loaded)

      // Fetch first image for each draft (thumbnails) — one query
      const firstIds = Array.from(new Set(loaded.map(d => d.image_ids[0]).filter(Boolean)))
      if (firstIds.length > 0) {
        const imgsRes = await fetch(`/api/images?ids=${firstIds.join(',')}`).then(r => r.json())
        const map: Record<string, string> = {}
        ;(imgsRes.data ?? []).forEach((img: ImageWithProxy) => { map[img.id] = img.proxy_url })
        setThumbMap(map)
      }
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

  async function deleteDraft(id: string) {
    if (!confirm('Delete this draft?')) return
    await fetch(`/api/drafts/${id}`, { method: 'DELETE' })
    setDrafts(prev => prev.filter(d => d.id !== id))
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  // Any selected draft can be posted — posted or not
  const selectedArray = Array.from(selectedIds)

  async function postSelected() {
    if (!selectedArray.length) return
    setPosting(true)
    setResults(null)
    setError(null)
    try {
      const res = await fetch('/api/drafts/bulk-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftIds: selectedArray }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResults(json.data)
      await load()
      setSelectedIds(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Posting failed')
    } finally {
      setPosting(false)
    }
  }

  const allSelected = drafts.length > 0 && drafts.every(d => selectedIds.has(d.id))

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-800">
        <h1 className="text-xl font-semibold">Draft Queue</h1>
        <div className="flex items-center gap-3">
          {drafts.length > 0 && (
            <button
              onClick={() => setSelectedIds(allSelected ? new Set() : new Set(drafts.map(d => d.id)))}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          )}
          {selectedArray.length > 0 && (
            <div className="flex items-center gap-2">
              {activeAccount && (
                <span className="text-xs text-gray-500">
                  as <span className="text-green-400">{activeAccount.display_name ?? `TikTok #${activeAccount.open_id.slice(-6)}`}</span>
                </span>
              )}
              {!activeAccount && (
                <a href="/api/auth/tiktok" className="text-xs text-yellow-500 hover:underline">Connect TikTok first</a>
              )}
              <button
                onClick={postSelected}
                disabled={posting || !activeAccount}
                className="px-4 py-1.5 text-sm bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50"
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
            {results.map(r => (
              <div key={r.draftId} className="flex items-center gap-2 text-sm">
                <span className={r.success ? 'text-green-400' : 'text-red-400'}>
                  {r.success ? '✓' : '✗'}
                </span>
                <span className="text-gray-400">
                  {r.success ? `Posted — ID: ${r.publish_id}` : r.error}
                </span>
              </div>
            ))}
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
        ) : drafts.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-gray-500 mb-4">No drafts yet.</p>
            <button
              onClick={() => router.push('/library')}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm transition-colors"
            >
              ← Go to Library
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {drafts.map(draft => (
              <DraftCard
                key={draft.id}
                draft={draft}
                thumbUrl={thumbMap[draft.image_ids[0]] ?? null}
                selected={selectedIds.has(draft.id)}
                onToggle={() => toggleSelect(draft.id)}
                onEdit={() => router.push(`/builder?draft=${draft.id}`)}
                onDelete={() => deleteDraft(draft.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
