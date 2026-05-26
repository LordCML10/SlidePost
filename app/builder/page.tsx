'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Draft, HashtagSet, ImageWithProxy } from '@/lib/types'

// ─── Builder content ─────────────────────────────────────────────────────────

function BuilderContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const imageParam = searchParams.get('images') // comma-separated IDs → new draft
  const draftParam = searchParams.get('draft')  // draft UUID → edit existing

  const [images, setImages] = useState<ImageWithProxy[]>([])
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [hashtagInput, setHashtagInput] = useState('')
  const [sets, setSets] = useState<HashtagSet[]>([])
  const [selectedSetId, setSelectedSetId] = useState('')
  const [draftName, setDraftName] = useState('')
  const [existingDraftId, setExistingDraftId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSaveSet, setShowSaveSet] = useState(false)
  const [newSetName, setNewSetName] = useState('')
  const [savingSet, setSavingSet] = useState(false)

  const dragIndex = useRef<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const setsRes = await fetch('/api/hashtag-sets').then(r => r.json())
      setSets(setsRes.data ?? [])

      if (draftParam) {
        // Edit mode — load existing draft
        const draftsRes = await fetch('/api/drafts').then(r => r.json())
        const draft = (draftsRes.data as Draft[]).find(d => d.id === draftParam)
        if (!draft) { setError('Draft not found'); return }

        setExistingDraftId(draft.id)
        setCaption(draft.caption)
        setDraftName(draft.name ?? '')
        if (draft.hashtag_set_id) {
          setSelectedSetId(draft.hashtag_set_id)
          const setData = setsRes.data?.find((s: HashtagSet) => s.id === draft.hashtag_set_id)
          if (setData) setHashtags(setData.hashtags)
        } else {
          setHashtags(draft.custom_hashtags ?? [])
        }

        const imgsRes = await fetch(`/api/images?ids=${draft.image_ids.join(',')}`).then(r => r.json())
        const imgMap = new Map((imgsRes.data ?? []).map((img: ImageWithProxy) => [img.id, img]))
        setImages(draft.image_ids.map((id: string) => imgMap.get(id)).filter(Boolean) as ImageWithProxy[])
      } else if (imageParam) {
        // New draft from library selection
        const imgsRes = await fetch(`/api/images?ids=${imageParam}`).then(r => r.json())
        const imgMap = new Map((imgsRes.data ?? []).map((img: ImageWithProxy) => [img.id, img]))
        setImages(imageParam.split(',').map(id => imgMap.get(id)).filter(Boolean) as ImageWithProxy[])
      }
    } finally {
      setLoading(false)
    }
  }, [imageParam, draftParam])

  useEffect(() => { load() }, [load])

  function handleSetChange(setId: string) {
    setSelectedSetId(setId)
    if (setId) {
      const set = sets.find(s => s.id === setId)
      if (set) setHashtags(set.hashtags)
    } else {
      setHashtags([])
    }
  }

  function addHashtag(raw: string) {
    const tag = raw.replace(/^#/, '').trim()
    if (tag && !hashtags.includes(tag)) {
      setHashtags(prev => [...prev, tag])
      setSelectedSetId('') // detach from saved set
    }
    setHashtagInput('')
  }

  function handleHashtagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (['Enter', ',', ' '].includes(e.key)) {
      e.preventDefault()
      if (hashtagInput.trim()) addHashtag(hashtagInput)
    } else if (e.key === 'Backspace' && !hashtagInput && hashtags.length > 0) {
      setHashtags(prev => prev.slice(0, -1))
    }
  }

  // Drag to reorder
  function handleDragStart(i: number) { dragIndex.current = i }
  function handleDrop(i: number) {
    if (dragIndex.current === null || dragIndex.current === i) return
    const next = [...images]
    const [moved] = next.splice(dragIndex.current, 1)
    next.splice(i, 0, moved)
    setImages(next)
    dragIndex.current = null
  }

  async function saveHashtagSet() {
    if (!newSetName.trim() || !hashtags.length) return
    setSavingSet(true)
    try {
      const res = await fetch('/api/hashtag-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSetName.trim(), hashtags }),
      })
      const json = await res.json()
      if (res.ok) {
        setSets(prev => [...prev, json.data])
        setSelectedSetId(json.data.id)
        setNewSetName('')
        setShowSaveSet(false)
      } else {
        setError(json.error)
      }
    } finally {
      setSavingSet(false)
    }
  }

  async function saveDraft() {
    if (images.length < 2) { setError('Select at least 2 images'); return }
    if (!caption.trim()) { setError('Caption is required'); return }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: draftName.trim() || null,
        image_ids: images.map(img => img.id),
        caption: caption.trim(),
        hashtag_set_id: selectedSetId || null,
        custom_hashtags: selectedSetId ? null : hashtags,
      }

      const res = existingDraftId
        ? await fetch(`/api/drafts/${existingDraftId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/drafts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      router.push('/drafts')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-7">
        <button onClick={() => router.push('/library')} className="text-gray-400 hover:text-white text-sm transition-colors">
          ← Library
        </button>
        <h1 className="text-xl font-semibold">{existingDraftId ? 'Edit Draft' : 'Build Draft'}</h1>
      </div>

      {/* Image strip */}
      <div className="mb-7">
        <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
          Images ({images.length} / 10) — drag to reorder
        </label>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((img, i) => (
            <div
              key={img.id}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(i)}
              className="relative shrink-0 w-20 h-20 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing border border-gray-700 hover:border-violet-500 transition-colors"
            >
              <img src={img.proxy_url} alt={img.filename} className="w-full h-full object-cover" />
              <span className="absolute bottom-0.5 left-0.5 text-[10px] bg-black/60 rounded px-1 text-white">
                {i + 1}
              </span>
              <button
                onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded bg-black/60 text-white flex items-center justify-center hover:bg-red-600/80 text-[10px]"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {images.length < 2 && (
          <p className="text-xs text-amber-500 mt-1.5">Need at least 2 images for a TikTok slideshow.</p>
        )}
      </div>

      {/* Caption */}
      <div className="mb-6">
        <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Caption</label>
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="Write your caption..."
          rows={4}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-violet-500 transition-colors"
        />
      </div>

      {/* Hashtags */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-500 uppercase tracking-wider">Hashtags</label>
          <div className="flex items-center gap-3">
            <select
              value={selectedSetId}
              onChange={e => handleSetChange(e.target.value)}
              className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 focus:outline-none focus:border-violet-500"
            >
              <option value="">Custom</option>
              {sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {hashtags.length > 0 && !showSaveSet && (
              <button onClick={() => setShowSaveSet(true)} className="text-xs text-violet-400 hover:text-violet-300">
                Save as set
              </button>
            )}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 flex flex-wrap gap-1.5 min-h-11 focus-within:border-violet-500 transition-colors">
          {hashtags.map((tag, i) => (
            <span key={i} className="flex items-center gap-1 bg-gray-800 rounded px-2 py-0.5 text-sm text-gray-300">
              #{tag}
              <button
                onClick={() => { setHashtags(prev => prev.filter((_, j) => j !== i)); setSelectedSetId('') }}
                className="text-gray-500 hover:text-white text-xs"
              >
                ✕
              </button>
            </span>
          ))}
          <input
            type="text"
            value={hashtagInput}
            onChange={e => setHashtagInput(e.target.value)}
            onKeyDown={handleHashtagKeyDown}
            onBlur={() => { if (hashtagInput.trim()) addHashtag(hashtagInput) }}
            placeholder={hashtags.length === 0 ? 'Type a hashtag and press Enter...' : ''}
            className="flex-1 min-w-24 bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none"
          />
        </div>
        {showSaveSet && (
          <div className="flex items-center gap-2 mt-2">
            <input
              autoFocus
              type="text"
              placeholder="Set name"
              value={newSetName}
              onChange={e => setNewSetName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveHashtagSet() }}
              className="flex-1 px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={saveHashtagSet}
              disabled={savingSet}
              className="px-3 py-1 text-sm bg-violet-600 hover:bg-violet-700 rounded disabled:opacity-50"
            >
              {savingSet ? '...' : 'Save'}
            </button>
            <button onClick={() => setShowSaveSet(false)} className="text-sm text-gray-500 hover:text-white">Cancel</button>
          </div>
        )}
      </div>

      {/* Draft name */}
      <div className="mb-8">
        <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
          Draft name <span className="normal-case text-gray-600">(optional)</span>
        </label>
        <input
          type="text"
          value={draftName}
          onChange={e => setDraftName(e.target.value)}
          placeholder="e.g. Monday food post"
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
        />
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <button
        onClick={saveDraft}
        disabled={saving || images.length < 2 || !caption.trim()}
        className="w-full py-3 bg-violet-600 hover:bg-violet-700 rounded-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? 'Saving...' : existingDraftId ? 'Update Draft' : 'Save Draft →'}
      </button>
    </div>
  )
}

// ─── Page wrapper (Suspense required for useSearchParams in Next.js 14) ───────

export default function BuilderPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500 text-sm">Loading...</div>}>
      <BuilderContent />
    </Suspense>
  )
}
