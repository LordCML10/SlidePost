'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import type { ImageWithProxy, Tag } from '@/lib/types'

// ─── Sub-components ─────────────────────────────────────────────────────────

function Thumb({
  image, selected, landscape, onToggle, onOpen, onLandscape,
}: {
  image: ImageWithProxy
  selected: boolean
  landscape: boolean
  onToggle: () => void
  onOpen: () => void
  onLandscape: () => void
}) {
  return (
    <div
      onClick={onOpen}
      className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer group ${
        selected ? 'ring-2 ring-violet-500 ring-offset-1 ring-offset-gray-950' : ''
      }`}
    >
      <img
        src={image.proxy_url}
        alt={image.filename}
        className="w-full h-full object-cover"
        onLoad={e => {
          const el = e.currentTarget
          if (el.naturalWidth > el.naturalHeight) onLandscape()
        }}
      />
      <div className={`absolute inset-0 bg-black transition-opacity ${
        selected ? 'bg-opacity-20' : 'bg-opacity-0 group-hover:bg-opacity-30'
      }`} />
      <button
        onClick={e => { e.stopPropagation(); onToggle() }}
        className={`absolute top-1.5 left-1.5 w-5 h-5 rounded border flex items-center justify-center transition-all ${
          selected
            ? 'bg-violet-600 border-violet-600 opacity-100'
            : 'bg-black/50 border-white/30 opacity-0 group-hover:opacity-100'
        }`}
      >
        {selected && (
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      {landscape && (
        <span className="absolute bottom-1 right-1 text-[9px] bg-yellow-500/90 text-black font-semibold px-1 rounded leading-4">
          ↔
        </span>
      )}
    </div>
  )
}

function ImageGrid({
  images, selectedIds, landscapeIds, onToggle, onOpen, onLandscape,
}: {
  images: ImageWithProxy[]
  selectedIds: Set<string>
  landscapeIds: Set<string>
  onToggle: (id: string) => void
  onOpen: (img: ImageWithProxy) => void
  onLandscape: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-1.5">
      {images.map(img => (
        <Thumb
          key={img.id}
          image={img}
          selected={selectedIds.has(img.id)}
          landscape={landscapeIds.has(img.id)}
          onToggle={() => onToggle(img.id)}
          onOpen={() => onOpen(img)}
          onLandscape={() => onLandscape(img.id)}
        />
      ))}
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-sm font-medium text-gray-300">{title}</span>
        <span className="text-xs text-gray-600">{count}</span>
        <div className="flex-1 h-px bg-gray-800" />
      </div>
      {children}
    </div>
  )
}

function Modal({
  image, tags, onClose, onMove, onDelete,
}: {
  image: ImageWithProxy
  tags: Tag[]
  onClose: () => void
  onMove: (imageId: string, tagId: string | null) => Promise<void>
  onDelete: (imageId: string) => Promise<void>
}) {
  const [moving, setMoving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleMove(tagId: string | null) {
    setMoving(true)
    await onMove(image.id, tagId)
    setMoving(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this image? This cannot be undone.')) return
    setDeleting(true)
    await onDelete(image.id)
    setDeleting(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-xl overflow-hidden max-w-2xl w-full flex flex-col sm:flex-row shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sm:w-80 bg-black flex items-center justify-center min-h-48">
          <img src={image.proxy_url} alt={image.filename} className="max-h-96 w-full object-contain" />
        </div>
        <div className="flex-1 p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-gray-300 font-medium truncate flex-1">{image.filename}</p>
            <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none shrink-0">✕</button>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Tag</label>
            <select
              value={image.tag_id ?? ''}
              disabled={moving}
              onChange={e => handleMove(e.target.value || null)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 disabled:opacity-50"
            >
              <option value="">Untagged</option>
              {tags.map(tag => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
            {moving && <p className="text-xs text-gray-500 mt-1">Moving...</p>}
          </div>
          <div className="mt-auto">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-full py-2 text-sm rounded-lg border border-red-900 text-red-400 hover:bg-red-900/30 transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete Image'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const router = useRouter()
  const { getToken } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [tags, setTags] = useState<Tag[]>([])
  const [images, setImages] = useState<ImageWithProxy[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [landscapeIds, setLandscapeIds] = useState<Set<string>>(new Set())
  const [modalImage, setModalImage] = useState<ImageWithProxy | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [showNewTag, setShowNewTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [creatingTag, setCreatingTag] = useState(false)

  const markLandscape = useCallback((id: string) => {
    setLandscapeIds(prev => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  // silent=true: refresh without showing the loading spinner (used after upload)
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [tr, ir] = await Promise.all([
        fetch('/api/tags', { cache: 'no-store' }).then(r => r.json()),
        fetch('/api/images', { cache: 'no-store' }).then(r => r.json()),
      ])
      if (ir.error) throw new Error(`/api/images: ${ir.error}`)
      setTags(tr.data ?? [])
      setImages(ir.data ?? [])
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to load images')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const visibleImages =
    activeTab === 'all' ? images
    : activeTab === 'untagged' ? images.filter(img => !img.tag_id)
    : images.filter(img => img.tag_id === activeTab)

  const untaggedImages = images.filter(img => !img.tag_id)
  const taggedSections = tags
    .map(tag => ({ tag, images: images.filter(img => img.tag_id === tag.id) }))
    .filter(s => s.images.length > 0)

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setImporting(true)
    setImportError(null)
    try {
      // Validate and normalise images before uploading.
      // - Strip ICC profiles via canvas re-encode (TikTok PULL_FROM_URL rejects them).
      // - Upscale to 720px shorter side if needed.
      // - Reject if longer side > 4096px.
      const validFiles: File[] = []
      const rejected: string[] = []
      await Promise.all(files.map(file => new Promise<void>(resolve => {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => {
          URL.revokeObjectURL(url)
          const shorter = Math.min(img.width, img.height)
          const longer = Math.max(img.width, img.height)

          if (longer > 4096) {
            rejected.push(`${file.name} (${img.width}×${img.height} — too large, max 4096px)`)
            resolve()
            return
          }

          // Always re-encode through canvas. This strips ICC profiles/EXIF and,
          // critically, forces 4:2:0 chroma subsampling: TikTok's PULL_FROM_URL
          // pipeline rejects 4:4:4 (non-subsampled) JPEGs with the misleading
          // picture_size_check_failed error. Chromium's canvas.toBlob emits 4:4:4
          // at high quality (>= ~0.90) and 4:2:0 at lower quality, so we encode at
          // 0.8 to guarantee 4:2:0. Also upscales if shorter side < 720px.
          const scale = shorter < 720 ? 720 / shorter : 1
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(img.width * scale)
          canvas.height = Math.round(img.height * scale)
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
          canvas.toBlob(blob => {
            if (blob) {
              validFiles.push(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
            } else {
              validFiles.push(file)
            }
            resolve()
          }, 'image/jpeg', 0.8)
          return
        }
        img.onerror = () => { URL.revokeObjectURL(url); validFiles.push(file); resolve() }
        img.src = url
      })))

      if (rejected.length > 0) {
        setImportError(`${rejected.length} image${rejected.length !== 1 ? 's' : ''} skipped (won't post to TikTok): ${rejected.join(', ')}`)
      }
      if (validFiles.length === 0) return

      const token = await getToken()
      const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) authHeaders['Authorization'] = `Bearer ${token}`

      // Direct-to-Supabase upload — file bytes never pass through Vercel,
      // so there's no 4.5 MB function body limit:
      //   1. Get a signed upload URL from our API (sends only filename/type/size)
      //   2. PUT the file straight to Supabase Storage using that URL
      //   3. Tell our API to register the image in the DB (sends only metadata)
      const uploaded = await Promise.all(
        validFiles.map(async (file) => {
          // Step 1 — generate signed URL
          const prepRes = await fetch('/api/upload/signed-url', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
          })
          const prep = await prepRes.json()
          if (!prepRes.ok) throw new Error(prep.error ?? 'Failed to prepare upload')

          // Step 2 — upload directly to Supabase (bypasses Vercel entirely)
          const storageRes = await fetch(prep.signedUrl as string, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
          })
          if (!storageRes.ok) throw new Error(`Storage upload failed (${storageRes.status})`)

          // Step 3 — register metadata in DB
          const completeRes = await fetch('/api/upload/complete', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ filename: file.name, storagePath: prep.storagePath, publicUrl: prep.publicUrl }),
          })
          const complete = await completeRes.json()
          if (!completeRes.ok) throw new Error(complete.error ?? 'Failed to save image')

          return complete.data as ImageWithProxy
        })
      )

      if (uploaded.length > 0) {
        setImages(prev => [...uploaded, ...prev])
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Upload failed')
      // Resync with DB so UI reflects actual state
      await load(true)
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function createTag() {
    if (!newTagName.trim() || creatingTag) return
    setCreatingTag(true)
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim() }),
      })
      const json = await res.json()
      if (res.ok) {
        setTags(prev => [...prev, json.data].sort((a, b) => a.name.localeCompare(b.name)))
        setNewTagName('')
        setShowNewTag(false)
      }
    } finally {
      setCreatingTag(false)
    }
  }

  async function moveImageToTag(imageId: string, tagId: string | null) {
    await fetch(`/api/images/${imageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: tagId }),
    })
    setImages(prev => prev.map(img => img.id === imageId ? { ...img, tag_id: tagId } : img))
    setModalImage(prev => prev?.id === imageId ? { ...prev, tag_id: tagId } : prev)
  }

  async function deleteImage(imageId: string) {
    const res = await fetch(`/api/images/${imageId}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setImportError(json.error ?? 'Delete failed')
      await load(true)
      setModalImage(null)
      return
    }
    setImages(prev => prev.filter(img => img.id !== imageId))
    setSelectedIds(prev => { const n = new Set(prev); n.delete(imageId); return n })
    setModalImage(null)
  }

  async function deleteSelected() {
    if (!confirm(`Delete ${selectedCount} image${selectedCount !== 1 ? 's' : ''}? This cannot be undone.`)) return
    const ids = Array.from(selectedIds)
    try {
      // Check every response — a silent 500 was causing "deleted" images to
      // reappear on the next load() because the DB record wasn't actually removed
      await Promise.all(
        ids.map(async id => {
          const res = await fetch(`/api/images/${id}`, { method: 'DELETE' })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error ?? 'Delete failed')
        })
      )
      setImages(prev => prev.filter(img => !selectedIds.has(img.id)))
      setSelectedIds(new Set())
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Delete failed')
      await load(true) // resync with what DB actually has
    }
  }

  const selectedCount = selectedIds.size

  return (
    <div className="min-h-screen">
      {importError && (
        <div className="flex items-center justify-between gap-4 px-6 py-3 bg-red-900/40 border-b border-red-800 text-sm text-red-300">
          <span>Upload failed: {importError}</span>
          <button onClick={() => setImportError(null)} className="text-red-400 hover:text-white shrink-0">✕</button>
        </div>
      )}
      {/* Page header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-800">
        <h1 className="text-xl font-semibold">Library</h1>
        <div className="flex items-center gap-3">
          {/* Label wraps the input — works in all browsers including Firefox */}
          <label className={`px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors cursor-pointer select-none ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
            {importing ? 'Importing...' : '↑ Import'}
            <input
              id="file-import-input"
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleImport}
            />
          </label>
          <button
            onClick={() => router.push(`/builder?images=${Array.from(selectedIds).slice(0, 10).join(',')}`)}
            disabled={selectedCount < 2}
            className="px-3 py-1.5 text-sm bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Build Draft{selectedCount >= 2 ? ` (${Math.min(selectedCount, 10)})` : ''} →
          </button>
        </div>
      </div>

      {/* Tag tabs */}
      <div className="px-6 py-3 flex items-center gap-2 flex-wrap border-b border-gray-800">
        {[{ id: 'all', name: 'All' }, { id: 'untagged', name: 'Untagged' }].map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); setSelectedIds(new Set()) }}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${
              activeTab === t.id
                ? 'bg-violet-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {t.name}
          </button>
        ))}
        {tags.map(tag => (
          <button
            key={tag.id}
            onClick={() => { setActiveTab(tag.id); setSelectedIds(new Set()) }}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${
              activeTab === tag.id
                ? 'bg-violet-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {tag.name}
          </button>
        ))}
        {showNewTag ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              placeholder="Tag name"
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') createTag()
                if (e.key === 'Escape') { setShowNewTag(false); setNewTagName('') }
              }}
              className="w-28 px-2 py-1 rounded-md text-sm bg-gray-800 border border-gray-600 focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={createTag}
              disabled={creatingTag}
              className="px-2 py-1 text-sm bg-violet-600 hover:bg-violet-700 rounded-md disabled:opacity-50"
            >
              {creatingTag ? '...' : 'Add'}
            </button>
            <button
              onClick={() => { setShowNewTag(false); setNewTagName('') }}
              className="px-2 py-1 text-sm text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewTag(true)}
            className="px-3 py-1 rounded-md text-sm text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
          >
            + New Tag
          </button>
        )}
        {visibleImages.length > 0 && (
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => setSelectedIds(new Set(visibleImages.map(img => img.id)))}
              className="text-xs text-gray-500 hover:text-white transition-colors"
            >
              Select All
            </button>
            {selectedCount > 0 && (
              <>
                <button
                  onClick={deleteSelected}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Delete ({selectedCount})
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs text-gray-500 hover:text-white transition-colors"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {loading ? (
          <p className="text-gray-600 text-sm">Loading...</p>
        ) : activeTab === 'all' ? (
          images.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-gray-500 mb-4">No images yet.</p>
              <label
                htmlFor="file-import-input"
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm transition-colors cursor-pointer"
              >
                ↑ Import your first images
              </label>
            </div>
          ) : (
            <div className="space-y-8">
              {untaggedImages.length > 0 && (
                <Section title="Untagged" count={untaggedImages.length}>
                  <ImageGrid images={untaggedImages} selectedIds={selectedIds} landscapeIds={landscapeIds} onToggle={toggleSelect} onOpen={setModalImage} onLandscape={markLandscape} />
                </Section>
              )}
              {taggedSections.map(({ tag, images: tagImgs }) => (
                <Section key={tag.id} title={tag.name} count={tagImgs.length}>
                  <ImageGrid images={tagImgs} selectedIds={selectedIds} landscapeIds={landscapeIds} onToggle={toggleSelect} onOpen={setModalImage} onLandscape={markLandscape} />
                </Section>
              ))}
            </div>
          )
        ) : visibleImages.length === 0 ? (
          <p className="text-gray-600 text-sm py-12">No images in this section.</p>
        ) : (
          <ImageGrid images={visibleImages} selectedIds={selectedIds} landscapeIds={landscapeIds} onToggle={toggleSelect} onOpen={setModalImage} onLandscape={markLandscape} />
        )}
      </div>

      {modalImage && (
        <Modal
          image={modalImage}
          tags={tags}
          onClose={() => setModalImage(null)}
          onMove={moveImageToTag}
          onDelete={deleteImage}
        />
      )}
    </div>
  )
}
