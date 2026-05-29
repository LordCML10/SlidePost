'use client'

import { useRef, useState } from 'react'

type Position = 'top' | 'center' | 'bottom'

interface Slide {
  file: File
  previewUrl: string
  text: string
  position: Position
}

// TikTok-exact text overlay styles
// -webkit-text-stroke gives a clean uniform outline (matches TikTok's stroke rendering).
// 8-directional shadows left tiny diagonal gaps; this is a true stroke.
// 6px stroke = ~3px visible outside each letter (half is inside, covered by white fill).
const OVERLAY_BASE: React.CSSProperties = {
  fontFamily: "'TikTokSans', 'Arial Black', sans-serif",
  fontWeight: 800,
  fontSize: '22px',
  color: '#ffffff',
  textAlign: 'center',
  letterSpacing: '-0.3px',
  lineHeight: 1.25,
  WebkitTextStroke: '4px rgba(0,0,0,0.95)',
  paintOrder: 'stroke', // render stroke behind fill so white text stays visible
  textShadow: '0 0 15px rgba(0,0,0,0.8)',
  padding: '0 16px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  position: 'absolute',
  left: 0,
  right: 0,
  zIndex: 10,
}

// Preview safe-zone positions — scaled from actual TikTok values (150 / 200px) to 480px frame
// 150 * (480/1920) ≈ 37px  |  200 * (480/1920) = 50px
function positionStyle(p: Position): React.CSSProperties {
  if (p === 'top')    return { top: '37px' }
  if (p === 'bottom') return { bottom: '50px' }
  return { top: '50%', transform: 'translateY(-50%)' }
}

// ─── Phone Mockup ─────────────────────────────────────────────────────────────

function PhoneMockup({
  slide, slides, activeIndex, onNavigate,
}: {
  slide: Slide | null
  slides: Slide[]
  activeIndex: number
  onNavigate: (i: number) => void
}) {
  return (
    <div
      style={{ width: 270, height: 480 }}
      className="relative rounded-[36px] overflow-hidden border-4 border-gray-600 bg-black shrink-0"
    >
      {/* Notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-3.5 bg-gray-700 rounded-b-xl z-20" />

      {/* Image */}
      {slide
        ? <img src={slide.previewUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        : <div className="absolute inset-0 flex items-center justify-center text-gray-700 text-xs text-center px-6">Add images to preview</div>
      }

      {/* Text overlay */}
      {slide?.text && (
        <div style={{ ...OVERLAY_BASE, ...positionStyle(slide.position) }}>
          {slide.text}
        </div>
      )}

      {/* Prev arrow */}
      {slides.length > 1 && activeIndex > 0 && (
        <button
          onClick={() => onNavigate(activeIndex - 1)}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Next arrow */}
      {slides.length > 1 && activeIndex < slides.length - 1 && (
        <button
          onClick={() => onNavigate(activeIndex + 1)}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Slide dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1 z-20">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => onNavigate(i)}
              className={`rounded-full transition-all ${
                i === activeIndex
                  ? 'w-4 h-1.5 bg-white'
                  : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverlayPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [slides, setSlides] = useState<Slide[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [burning, setBurning] = useState(false)
  const [burnedPreview, setBurnedPreview] = useState<string | null>(null)
  const [burnError, setBurnError] = useState<string | null>(null)

  const activeSlide = slides[activeIndex] ?? null

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
      .filter(f => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type))
      .slice(0, 10 - slides.length)

    if (!files.length) return

    const newSlides: Slide[] = files.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      text: '',
      position: 'center' as Position,
    }))

    setSlides(prev => {
      const next = [...prev, ...newSlides]
      if (prev.length === 0) setActiveIndex(0)
      return next
    })
    setBurnedPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function updateActive(patch: Partial<Pick<Slide, 'text' | 'position'>>) {
    setSlides(prev => prev.map((s, i) => i === activeIndex ? { ...s, ...patch } : s))
    setBurnedPreview(null)
  }

  function goTo(index: number) {
    setActiveIndex(index)
    setBurnedPreview(null)
  }

  function removeSlide(i: number) {
    setSlides(prev => {
      const next = prev.filter((_, j) => j !== i)
      setActiveIndex(cur => Math.min(cur, Math.max(0, next.length - 1)))
      return next
    })
    setBurnedPreview(null)
  }

  async function burnPreview() {
    if (!activeSlide?.text.trim()) return
    setBurning(true)
    setBurnError(null)
    setBurnedPreview(null)
    try {
      const fd = new FormData()
      fd.append('image', activeSlide.file)
      fd.append('text', activeSlide.text)
      fd.append('position', activeSlide.position)

      const res = await fetch('/api/overlay/process', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Processing failed')
      setBurnedPreview(json.data)
    } catch (err) {
      setBurnError(err instanceof Error ? err.message : 'Processing failed')
    } finally {
      setBurning(false)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800">
        <h1 className="text-xl font-semibold">Text Overlay</h1>
        <p className="text-sm text-gray-500 mt-0.5">Preview text burned into slides before posting</p>
      </div>

      <div className="px-6 py-6 flex gap-8 items-start flex-wrap">

        {/* ── Left: phone mockup + burned result ─────────────────────────────── */}
        <div className="flex gap-6 items-start shrink-0">

          {/* CSS preview */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Preview</span>
            <PhoneMockup
              slide={activeSlide}
              slides={slides}
              activeIndex={activeIndex}
              onNavigate={goTo}
            />
          </div>

          {/* Burned result */}
          {burnedPreview && (
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Burned</span>
              <div
                style={{ width: 270, height: 480 }}
                className="rounded-[36px] overflow-hidden border-4 border-gray-600 bg-black shrink-0"
              >
                <img
                  src={`data:image/jpeg;base64,${burnedPreview}`}
                  alt="Burned preview"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Right: controls ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-[240px] max-w-sm space-y-5">

          {/* Upload */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Slides</label>
            <label className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors cursor-pointer select-none ${slides.length >= 10 ? 'opacity-40 pointer-events-none' : ''}`}>
              ↑ Add Images
              {slides.length > 0 && (
                <span className="text-gray-500 text-xs">{slides.length}/10</span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFiles}
              />
            </label>
          </div>

          {/* Thumbnail strip */}
          {slides.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {slides.map((slide, i) => (
                <div key={i} className="relative shrink-0">
                  <button
                    onClick={() => goTo(i)}
                    className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors block ${
                      i === activeIndex ? 'border-violet-500' : 'border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    <img src={slide.previewUrl} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                  {/* Remove button */}
                  <button
                    onClick={() => removeSlide(i)}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gray-700 hover:bg-red-700 text-white flex items-center justify-center text-[9px] transition-colors"
                  >
                    ✕
                  </button>
                  {/* Dot if slide has text */}
                  {slide.text && (
                    <span className="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-violet-400" />
                  )}
                </div>
              ))}
            </div>
          )}

          {activeSlide ? (
            <>
              {/* Text input */}
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
                  Text — Slide {activeIndex + 1}
                </label>
                <textarea
                  value={activeSlide.text}
                  onChange={e => updateActive({ text: e.target.value })}
                  placeholder="Type your overlay text..."
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              {/* Position picker */}
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Position</label>
                <div className="flex gap-2">
                  {(['top', 'center', 'bottom'] as Position[]).map(pos => (
                    <button
                      key={pos}
                      onClick={() => updateActive({ position: pos })}
                      className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors capitalize ${
                        activeSlide.position === pos
                          ? 'bg-violet-600 border-violet-600 text-white'
                          : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              {/* Burn button */}
              <div>
                <button
                  onClick={burnPreview}
                  disabled={burning || !activeSlide.text.trim()}
                  className="w-full py-2.5 text-sm bg-violet-600 hover:bg-violet-700 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {burning ? 'Processing...' : 'Preview burned version'}
                </button>
                {burnError && (
                  <p className="text-xs text-red-400 mt-2">{burnError}</p>
                )}
                {burnedPreview && !burnError && (
                  <p className="text-xs text-gray-600 mt-2">Compare left (CSS) vs right (burned) — they should match.</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-600">Add images to get started.</p>
          )}
        </div>
      </div>
    </div>
  )
}
