'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

type ImageFile = {
  id: string
  file: File
  preview: string
}

type PostStatus = { type: 'success' | 'error'; message: string }

export default function Home() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [authError, setAuthError] = useState(false)
  const [images, setImages] = useState<ImageFile[]>([])
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [hashtagInput, setHashtagInput] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [posting, setPosting] = useState(false)
  const [status, setStatus] = useState<PostStatus | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  // Track all object URLs so we can revoke them on unmount
  const previewUrlsRef = useRef<Set<string>>(new Set())

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

  // Revoke all object URLs on unmount
  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  const addFiles = useCallback((files: FileList | File[]) => {
    const valid = Array.from(files).filter((f) => ALLOWED_TYPES.includes(f.type))
    setImages((prev) => {
      const slots = 10 - prev.length
      const toAdd = valid.slice(0, slots).map((file) => {
        const preview = URL.createObjectURL(file)
        previewUrlsRef.current.add(preview)
        return { id: crypto.randomUUID(), file, preview }
      })
      return [...prev, ...toAdd]
    })
  }, [])

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id)
      if (img) {
        URL.revokeObjectURL(img.preview)
        previewUrlsRef.current.delete(img.preview)
      }
      return prev.filter((i) => i.id !== id)
    })
  }, [])

  const addHashtag = (raw: string) => {
    const tag = raw.replace(/^#+/, '').trim()
    if (tag && !hashtags.includes(tag)) {
      setHashtags((prev) => [...prev, tag])
    }
    setHashtagInput('')
  }

  const onHashtagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', ' '].includes(e.key)) {
      e.preventDefault()
      if (hashtagInput.trim()) addHashtag(hashtagInput)
    } else if (e.key === 'Backspace' && hashtagInput === '' && hashtags.length > 0) {
      setHashtags((prev) => prev.slice(0, -1))
    }
  }

  const clearForm = () => {
    setImages((prev) => {
      prev.forEach((img) => {
        URL.revokeObjectURL(img.preview)
        previewUrlsRef.current.delete(img.preview)
      })
      return []
    })
    setCaption('')
    setHashtags([])
    setHashtagInput('')
  }

  const canPost = connected === true && images.length >= 2 && !posting

  const handlePost = async () => {
    if (!canPost) return
    setPosting(true)
    setStatus(null)

    const formData = new FormData()
    formData.append('caption', caption)
    hashtags.forEach((h) => formData.append('hashtags', h))
    images.forEach((img) => formData.append('images', img.file))

    try {
      const res = await fetch('/api/post', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setStatus({ type: 'error', message: data.error ?? 'Something went wrong' })
      } else {
        setStatus({
          type: 'success',
          message: `Draft sent to TikTok inbox ✓  (ID: ${data.data.publish_id})`,
        })
        clearForm()
      }
    } catch {
      setStatus({ type: 'error', message: 'Network error — please try again' })
    } finally {
      setPosting(false)
    }
  }

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

        {/* Drop zone */}
        <div
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files) }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`rounded-lg border-2 border-dashed px-6 py-12 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-white bg-gray-800'
              : 'border-gray-700 bg-gray-900 hover:border-gray-500'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files) }}
          />
          <p className="text-gray-400 text-sm">
            {isDragging ? 'Drop images here' : 'Drag & drop or click to upload'}
          </p>
          <p className="text-gray-600 text-xs mt-1">
            JPG, PNG, WEBP · Max 5MB each · {images.length}/10 images
          </p>
        </div>

        {/* Image previews */}
        {images.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {images.map((img) => (
              <div key={img.id} className="relative flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.preview}
                  alt=""
                  className="w-24 h-24 object-cover rounded-lg"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); removeImage(img.id) }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-900 border border-gray-600 text-gray-300 text-xs flex items-center justify-center hover:bg-red-900 hover:border-red-600 transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Caption */}
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Caption..."
          rows={3}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-gray-500 transition-colors"
        />

        {/* Hashtags */}
        <div
          className="flex flex-wrap gap-2 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 focus-within:border-gray-500 transition-colors cursor-text"
          onClick={() => document.getElementById('hashtag-input')?.focus()}
        >
          {hashtags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 bg-gray-800 text-sm text-white px-2.5 py-1 rounded-full"
            >
              #{tag}
              <button
                onClick={() => setHashtags((prev) => prev.filter((t) => t !== tag))}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </span>
          ))}
          <input
            id="hashtag-input"
            value={hashtagInput}
            onChange={(e) => setHashtagInput(e.target.value)}
            onKeyDown={onHashtagKeyDown}
            onBlur={() => { if (hashtagInput.trim()) addHashtag(hashtagInput) }}
            placeholder={hashtags.length === 0 ? 'Add hashtags...' : ''}
            className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none"
          />
        </div>

        {/* Status */}
        {status && (
          <div
            className={`rounded-lg px-4 py-3 text-sm ${
              status.type === 'success'
                ? 'bg-green-900/40 border border-green-700 text-green-300'
                : 'bg-red-900/40 border border-red-700 text-red-300'
            }`}
          >
            {status.message}
          </div>
        )}

        {/* Post button */}
        <button
          onClick={handlePost}
          disabled={!canPost}
          className={`w-full font-semibold py-3 rounded-lg text-sm transition-all ${
            canPost
              ? 'bg-white text-black hover:bg-gray-100 cursor-pointer'
              : 'bg-white text-black opacity-30 cursor-not-allowed'
          }`}
        >
          {posting ? 'Posting...' : 'Post as Draft'}
        </button>
      </div>
    </main>
  )
}
