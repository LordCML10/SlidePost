'use client'

import { useState, useEffect } from 'react'
import type { Draft, ImageWithProxy, HashtagSet, TikTokAccount } from '@/lib/types'

type Position = 'top' | 'center' | 'bottom'

interface Slide {
  file: File
  previewUrl: string
  text: string
  position: Position
  burnedB64: string | null
}

// ─── TikTok-exact overlay styles ──────────────────────────────────────────────
const OVERLAY_BASE: React.CSSProperties = {
  fontFamily: "'TikTokSans', 'Arial Black', sans-serif",
  fontWeight: 800,
  fontSize: '20px',
  color: '#ffffff',
  textAlign: 'center',
  letterSpacing: '-0.3px',
  lineHeight: 1.25,
  WebkitTextStroke: '4px rgba(0,0,0,0.95)',
  paintOrder: 'stroke',
  textShadow: '0 0 15px rgba(0,0,0,0.8)',
  padding: '0 16px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  position: 'absolute',
  left: 0,
  right: 0,
  zIndex: 10,
}

function positionStyle(p: Position): React.CSSProperties {
  if (p === 'top') return { top: '37px' }
  if (p === 'bottom') return { bottom: '50px' }
  return { top: '50%', transform: 'translateY(-50%)' }
}

// ─── Phone Mockup ─────────────────────────────────────────────────────────────
function PhoneMockup({
  slide, showBurned, slides, activeIndex, onNavigate,
}: {
  slide: Slide | null
  showBurned: boolean
  slides: Slide[]
  activeIndex: number
  onNavigate: (i: number) => void
}) {
  const useBurned = showBurned && !!slide?.burnedB64

  return (
    <div
      style={{ width: 270, height: 480 }}
      className="relative rounded-[36px] overflow-hidden border-4 border-gray-700 bg-black shrink-0 shadow-2xl"
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-3.5 bg-gray-700 rounded-b-xl z-20" />

      {slide ? (
        useBurned ? (
          <img
            src={`data:image/jpeg;base64,${slide.burnedB64}`}
            alt="Burned preview"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <>
            <img src={slide.previewUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            {slide.text && (
              <div style={{ ...OVERLAY_BASE, ...positionStyle(slide.position) }}>
                {slide.text}
              </div>
            )}
          </>
        )
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-600 text-xs text-center px-8">
          <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18M3.75 3h16.5A.75.75 0 0121 3.75v16.5A.75.75 0 0120.25 21H3.75A.75.75 0 013 21V3.75A.75.75 0 013.75 3z" />
          </svg>
          Load a draft or upload images
        </div>
      )}

      {slides.length > 1 && activeIndex > 0 && (
        <button onClick={() => onNavigate(activeIndex - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
      )}
      {slides.length > 1 && activeIndex < slides.length - 1 && (
        <button onClick={() => onNavigate(activeIndex + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      )}
      {slides.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1 z-20">
          {slides.map((_, i) => (
            <button key={i} onClick={() => onNavigate(i)} className={`rounded-full transition-all ${i === activeIndex ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/60'}`} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function OverlayPage() {
  // Source
  const [mode, setMode] = useState<'upload' | 'draft'>('upload')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loadingDraft, setLoadingDraft] = useState(false)

  // Hashtag sets
  const [hashtagSets, setHashtagSets] = useState<HashtagSet[]>([])
  const [selectedHashtagSetId, setSelectedHashtagSetId] = useState<string | null>(null)

  // Slides
  const [slides, setSlides] = useState<Slide[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [showBurned, setShowBurned] = useState(false)

  // Post metadata
  const [caption, setCaption] = useState('')

  // Burn
  const [burningAll, setBurningAll] = useState(false)
  const [burnProgress, setBurnProgress] = useState(0)
  const [burnError, setBurnError] = useState<string | null>(null)

  // Active TikTok account (for "posting as" indicator)
  const [activeAccount, setActiveAccount] = useState<TikTokAccount | null | 'loading'>('loading')

  // Post to TikTok
  const [posting, setPosting] = useState(false)
  const [postStatus, setPostStatus] = useState<string | null>(null)
  const [postResult, setPostResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // Save as new draft
  const [newDraftName, setNewDraftName] = useState('')
  const [savingDraft, setSavingDraft] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const activeSlide = slides[activeIndex] ?? null
  const burnedCount = slides.filter(s => s.burnedB64).length
  const allBurned = slides.length > 0 && slides.every(s => s.burnedB64 !== null)
  const canPost = allBurned && slides.length >= 2

  // Selected hashtag set data (for preview)
  const selectedSet = hashtagSets.find(s => s.id === selectedHashtagSetId) ?? null
  const hashtagPreview = selectedSet
    ? selectedSet.hashtags.map(h => (h.startsWith('#') ? h : `#${h}`)).join(' ')
    : null

  // ── Fetch reference data on mount ──────────────────────────────────────────
  useEffect(() => {
    fetch('/api/drafts')
      .then(r => r.json())
      .then(j => { if (j.data) setDrafts(j.data) })
      .catch(() => {})

    fetch('/api/hashtag-sets')
      .then(r => r.json())
      .then(j => { if (j.data) setHashtagSets(j.data) })
      .catch(() => {})

    fetch('/api/auth/tiktok/accounts')
      .then(r => r.json())
      .then(j => {
        const all: TikTokAccount[] = j.accounts ?? []
        const active = all.find(a => a.id === j.activeAccountId) ?? null
        setActiveAccount(active)
      })
      .catch(() => setActiveAccount(null))
  }, [])

  // Auto-switch to burned view when active slide gets burned
  useEffect(() => {
    if (activeSlide?.burnedB64) setShowBurned(true)
  }, [activeSlide?.burnedB64])

  // ── Draft loading ───────────────────────────────────────────────────────────
  async function selectDraft(draftId: string) {
    const draft = drafts.find(d => d.id === draftId)
    if (!draft) return

    setLoadingDraft(true)
    setBurnError(null)
    setPostResult(null)
    setSaveResult(null)

    try {
      const res = await fetch(`/api/images?ids=${draft.image_ids.join(',')}`)
      const json = await res.json()
      const records: ImageWithProxy[] = json.data ?? []
      const map = new Map(records.map(r => [r.id, r]))
      const ordered = draft.image_ids.map(id => map.get(id)).filter(Boolean) as ImageWithProxy[]

      const newSlides: Slide[] = await Promise.all(
        ordered.map(async img => {
          const blobRes = await fetch(img.proxy_url)
          const blob = await blobRes.blob()
          return {
            file: new File([blob], img.filename, { type: blob.type || 'image/jpeg' }),
            previewUrl: URL.createObjectURL(blob),
            text: '',
            position: 'center' as Position,
            burnedB64: null,
          }
        })
      )

      setSlides(newSlides)
      setCaption(draft.caption)
      // Pre-select the draft's hashtag set if it exists in our saved sets
      setSelectedHashtagSetId(draft.hashtag_set_id ?? null)
      setActiveIndex(0)
      setShowBurned(false)
      // Suggest the original draft name + "(overlay)" as the new draft name
      setNewDraftName(`${draft.name ?? 'Draft'} (overlay)`)
    } catch {
      setBurnError('Failed to load draft images — check your connection')
    } finally {
      setLoadingDraft(false)
    }
  }

  // ── File upload ─────────────────────────────────────────────────────────────
  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
      .filter(f => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type))
      .slice(0, 10 - slides.length)
    if (!files.length) return
    setSlides(prev => [
      ...prev,
      ...files.map(file => ({
        file,
        previewUrl: URL.createObjectURL(file),
        text: '',
        position: 'center' as Position,
        burnedB64: null,
      })),
    ])
    setPostResult(null)
    setSaveResult(null)
    e.target.value = ''
  }

  // ── Slide helpers ───────────────────────────────────────────────────────────
  function updateActive(patch: Partial<Pick<Slide, 'text' | 'position'>>) {
    setSlides(prev => prev.map((s, i) => i === activeIndex ? { ...s, ...patch, burnedB64: null } : s))
    setShowBurned(false)
    setPostResult(null)
    setSaveResult(null)
  }

  function goTo(i: number) {
    setActiveIndex(i)
    setShowBurned(!!slides[i]?.burnedB64)
  }

  function removeSlide(i: number) {
    setSlides(prev => {
      URL.revokeObjectURL(prev[i].previewUrl)
      const next = prev.filter((_, j) => j !== i)
      setActiveIndex(cur => Math.min(cur, Math.max(0, next.length - 1)))
      return next
    })
    setPostResult(null)
    setSaveResult(null)
  }

  // ── Burn All ────────────────────────────────────────────────────────────────
  async function burnAll() {
    const missing = slides.findIndex(s => !s.text.trim())
    if (missing !== -1) {
      setBurnError(`Slide ${missing + 1} has no text — add text to every slide first`)
      return
    }
    setBurningAll(true)
    setBurnError(null)
    setBurnProgress(0)
    setPostResult(null)
    setSaveResult(null)

    try {
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i]
        const fd = new FormData()
        fd.append('image', slide.file)
        fd.append('text', slide.text)
        fd.append('position', slide.position)
        const res = await fetch('/api/overlay/process', { method: 'POST', body: fd })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? `Slide ${i + 1} failed`)
        const b64: string = json.data
        setSlides(prev => prev.map((s, j) => j === i ? { ...s, burnedB64: b64 } : s))
        setBurnProgress(i + 1)
      }
      setShowBurned(true)
    } catch (err) {
      setBurnError(err instanceof Error ? err.message : 'Burn failed')
    } finally {
      setBurningAll(false)
    }
  }

  // ── Download All ────────────────────────────────────────────────────────────
  function downloadAll() {
    slides.forEach((slide, i) => {
      if (!slide.burnedB64) return
      setTimeout(() => {
        const a = document.createElement('a')
        a.href = `data:image/jpeg;base64,${slide.burnedB64}`
        a.download = `slide-${i + 1}.jpg`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }, i * 300)
    })
  }

  // ── Upload helper (shared by Post and Save Draft) ───────────────────────────
  async function uploadSlide(b64: string, save: boolean) {
    const res = await fetch('/api/overlay/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: b64, save }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Upload failed')
    return json as { proxy_url: string; image_id?: string }
  }

  // ── Post to TikTok ──────────────────────────────────────────────────────────
  async function postToTikTok() {
    if (!canPost) return
    if (!caption.trim()) { setBurnError('Add a TikTok caption before posting'); return }

    setPosting(true)
    setPostResult(null)
    setBurnError(null)

    try {
      const proxyUrls: string[] = []
      for (let i = 0; i < slides.length; i++) {
        setPostStatus(`Uploading slide ${i + 1} of ${slides.length}…`)
        const { proxy_url } = await uploadSlide(slides[i].burnedB64!, false)
        proxyUrls.push(proxy_url)
      }

      setPostStatus('Posting to TikTok…')
      const res = await fetch('/api/overlay/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proxy_urls: proxyUrls,
          caption: caption.trim(),
          hashtag_set_id: selectedHashtagSetId,
          custom_hashtags: null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Post failed')
      setPostResult({ ok: true, msg: 'Posted to TikTok! It may take a minute to appear.' })
    } catch (err) {
      setPostResult({ ok: false, msg: err instanceof Error ? err.message : 'Failed to post' })
    } finally {
      setPosting(false)
      setPostStatus(null)
    }
  }

  // ── Save as New Draft ───────────────────────────────────────────────────────
  async function saveAsDraft() {
    if (!canPost) return
    if (!newDraftName.trim()) { setBurnError('Enter a name for the new draft'); return }
    if (!caption.trim()) { setBurnError('Add a caption before saving'); return }

    setSavingDraft(true)
    setSaveResult(null)
    setBurnError(null)

    try {
      // Upload each burned image with save:true to get an image_id for the DB
      const imageIds: string[] = []
      for (let i = 0; i < slides.length; i++) {
        setSaveStatus(`Saving slide ${i + 1} of ${slides.length}…`)
        const { image_id } = await uploadSlide(slides[i].burnedB64!, true)
        if (!image_id) throw new Error(`No image_id returned for slide ${i + 1}`)
        imageIds.push(image_id)
      }

      // Create the draft using the existing /api/drafts endpoint
      setSaveStatus('Creating draft…')
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDraftName.trim(),
          image_ids: imageIds,
          caption: caption.trim(),
          hashtag_set_id: selectedHashtagSetId,
          custom_hashtags: null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create draft')

      setSaveResult({ ok: true, msg: `Saved as "${newDraftName.trim()}" — find it in your Drafts tab.` })
      setNewDraftName('')
    } catch (err) {
      setSaveResult({ ok: false, msg: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setSavingDraft(false)
      setSaveStatus(null)
    }
  }

  const hasSlides = slides.length > 0

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      <div className="px-6 py-4 border-b border-gray-800">
        <h1 className="text-xl font-semibold">Text Overlay</h1>
        <p className="text-sm text-gray-500 mt-0.5">Burn text into slides and post to TikTok</p>
      </div>

      <div className="px-6 py-6 flex gap-10 items-start flex-wrap">

        {/* ── Phone ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 shrink-0">
          {activeSlide?.burnedB64 ? (
            <div className="flex rounded-full bg-gray-800 p-0.5 text-xs">
              <button onClick={() => setShowBurned(false)} className={`px-3 py-1 rounded-full transition-colors ${!showBurned ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>Preview</button>
              <button onClick={() => setShowBurned(true)} className={`px-3 py-1 rounded-full transition-colors ${showBurned ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}>Burned ✓</button>
            </div>
          ) : (
            <div className="h-[26px]" />
          )}

          <PhoneMockup
            slide={activeSlide}
            showBurned={showBurned}
            slides={slides}
            activeIndex={activeIndex}
            onNavigate={goTo}
          />

          <p className="text-xs text-gray-600">
            {hasSlides
              ? `${activeIndex + 1} / ${slides.length}${allBurned ? ' · All burned ✓' : burnedCount > 0 ? ` · ${burnedCount}/${slides.length} burned` : ''}`
              : 'No slides loaded'}
          </p>
        </div>

        {/* ── Controls ──────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-[280px] max-w-[420px] space-y-5">

          {/* Source */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">Source</label>
            <div className="flex gap-2">
              <button onClick={() => setMode('upload')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'upload' ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>↑ Upload</button>
              <button onClick={() => setMode('draft')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'draft' ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>📂 Load Draft</button>
            </div>
            {mode === 'draft' && (
              <div className="mt-2">
                {drafts.length === 0 ? (
                  <p className="text-xs text-gray-500 mt-1">No drafts yet — create one in the Drafts tab first.</p>
                ) : (
                  <select
                    className="w-full bg-gray-800 border border-gray-700 text-sm text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500 disabled:opacity-50"
                    defaultValue=""
                    onChange={e => { if (e.target.value) selectDraft(e.target.value) }}
                    disabled={loadingDraft}
                  >
                    <option value="" disabled>{loadingDraft ? 'Loading images…' : 'Select a draft…'}</option>
                    {drafts.map(d => (
                      <option key={d.id} value={d.id}>{d.name ?? 'Untitled'} · {d.image_ids.length} slides</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Slides strip */}
          {(hasSlides || mode === 'upload') && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Slides {hasSlides && `${slides.length}/10`}
                </label>
                {mode === 'upload' && slides.length < 10 && (
                  <label className="text-xs text-violet-400 hover:text-violet-300 cursor-pointer transition-colors">
                    + Add More
                    <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFiles} />
                  </label>
                )}
              </div>

              {mode === 'upload' && slides.length === 0 ? (
                <label className="flex flex-col items-center justify-center w-full h-24 rounded-xl border-2 border-dashed border-gray-700 hover:border-violet-600 text-gray-500 hover:text-gray-400 text-sm cursor-pointer transition-colors gap-1.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                  Click to upload (up to 10 images)
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFiles} />
                </label>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {slides.map((slide, i) => (
                    <div key={i} className="relative shrink-0 group">
                      <button onClick={() => goTo(i)} className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all block ${i === activeIndex ? 'border-violet-500 scale-105' : 'border-gray-700 hover:border-gray-500'}`}>
                        <img src={slide.previewUrl} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
                      </button>
                      {slide.burnedB64 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border border-gray-900 flex items-center justify-center text-[8px] text-white pointer-events-none">✓</span>
                      )}
                      {mode === 'upload' && (
                        <button onClick={() => removeSlide(i)} className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-gray-700 hover:bg-red-700 text-white flex items-center justify-center text-[8px] transition-colors opacity-0 group-hover:opacity-100">✕</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Per-slide text + position */}
          {activeSlide && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">Text — Slide {activeIndex + 1}</label>
                <textarea
                  className="w-full bg-gray-900 border border-gray-700 text-sm text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500 resize-none placeholder-gray-600"
                  rows={3}
                  placeholder="Type your slide caption…"
                  value={activeSlide.text}
                  onChange={e => updateActive({ text: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">Position</label>
                <div className="flex gap-1.5">
                  {(['top', 'center', 'bottom'] as Position[]).map(p => (
                    <button key={p} onClick={() => updateActive({ position: p })} className={`flex-1 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${activeSlide.position === p ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>{p}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TikTok Caption + Hashtag Set */}
          {hasSlides && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">TikTok Caption</label>
                <textarea
                  className="w-full bg-gray-900 border border-gray-700 text-sm text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500 resize-none placeholder-gray-600"
                  rows={2}
                  placeholder="Caption for your TikTok post…"
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">Hashtag Set</label>
                <select
                  className="w-full bg-gray-900 border border-gray-700 text-sm text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-500"
                  value={selectedHashtagSetId ?? ''}
                  onChange={e => setSelectedHashtagSetId(e.target.value || null)}
                >
                  <option value="">None</option>
                  {hashtagSets.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {hashtagPreview && (
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{hashtagPreview}</p>
                )}
                {hashtagSets.length === 0 && (
                  <p className="text-xs text-gray-600 mt-1">No hashtag sets saved — create some in the Captions tab.</p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          {hasSlides && (
            <div className="space-y-2.5">
              {/* Burn All */}
              <button
                onClick={burnAll}
                disabled={burningAll}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {burningAll
                  ? `Burning slide ${burnProgress} of ${slides.length}…`
                  : allBurned
                  ? `↻ Re-burn All ${slides.length} Slides`
                  : `🔥 Burn All ${slides.length} Slide${slides.length !== 1 ? 's' : ''}`}
              </button>

              {canPost && (
                <>
                  {/* TikTok account indicator */}
                  {activeAccount === null ? (
                    <p className="text-xs text-yellow-600">
                      No TikTok account connected —{' '}
                      <a href="/api/auth/tiktok" className="text-violet-400 hover:underline">Connect now</a>
                    </p>
                  ) : activeAccount !== 'loading' && (
                    <p className="text-xs text-gray-500">
                      Posting as{' '}
                      <span className="text-green-400">
                        {activeAccount.display_name ?? `TikTok #${activeAccount.open_id.slice(-6)}`}
                      </span>
                      {' '}· <a href="#" onClick={e => { e.preventDefault(); window.location.href='/api/auth/tiktok' }} className="text-violet-400 hover:underline">switch</a>
                    </p>
                  )}

                  {/* Download + Post */}
                  <div className="flex gap-2">
                    <button onClick={downloadAll} className="flex-1 py-2 rounded-xl text-sm font-medium bg-gray-800 hover:bg-gray-700 text-white transition-colors">↓ Download</button>
                    <button onClick={postToTikTok} disabled={posting || activeAccount === null} className="flex-1 py-2 rounded-xl text-sm font-semibold bg-pink-600 hover:bg-pink-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {posting ? (postStatus ?? 'Posting…') : '🚀 Post to TikTok'}
                    </button>
                  </div>
                  {postResult && (
                    <p className={`text-xs ${postResult.ok ? 'text-green-400' : 'text-red-400'}`}>{postResult.msg}</p>
                  )}

                  {/* Save as New Draft */}
                  <div className="pt-1 border-t border-gray-800">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">Save as New Draft</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 bg-gray-900 border border-gray-700 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500 placeholder-gray-600 min-w-0"
                        placeholder="New draft name…"
                        value={newDraftName}
                        onChange={e => setNewDraftName(e.target.value)}
                      />
                      <button
                        onClick={saveAsDraft}
                        disabled={savingDraft || !newDraftName.trim()}
                        className="shrink-0 px-3 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {savingDraft ? (saveStatus ?? 'Saving…') : '💾 Save Draft'}
                      </button>
                    </div>
                    {saveResult && (
                      <p className={`text-xs mt-1.5 ${saveResult.ok ? 'text-green-400' : 'text-red-400'}`}>{saveResult.msg}</p>
                    )}
                  </div>
                </>
              )}

              {/* Hints */}
              {!allBurned && !burningAll && slides.length >= 2 && (
                <p className="text-xs text-gray-600 text-center">Burn all slides to unlock download, post & save</p>
              )}
              {allBurned && slides.length < 2 && (
                <p className="text-xs text-yellow-600 text-center">TikTok requires at least 2 slides to post</p>
              )}
              {burnError && <p className="text-xs text-red-400">{burnError}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
