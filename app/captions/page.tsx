'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Caption } from '@/lib/types'

export default function CaptionsPage() {
  const [captions, setCaptions] = useState<Caption[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newText, setNewText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/captions', { cache: 'no-store' }).then(r => r.json())
      setCaptions(res.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function createCaption() {
    if (!newName.trim() || !newText.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), text: newText.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setCaptions(prev => [...prev, json.data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
      setNewText('')
      setShowNew(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function deleteCaption(id: string) {
    if (!confirm('Delete this caption?')) return
    await fetch(`/api/captions/${id}`, { method: 'DELETE' })
    setCaptions(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="min-h-screen">
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-800">
        <h1 className="text-xl font-semibold">Caption Library</h1>
        <button
          onClick={() => setShowNew(v => !v)}
          className="px-3 py-1.5 text-sm bg-white text-gray-950 hover:bg-gray-200 rounded-lg transition-colors"
        >
          {showNew ? 'Cancel' : '+ New Caption'}
        </button>
      </div>

      {showNew && (
        <div className="mx-6 mt-5 p-5 bg-gray-900 rounded-xl border border-gray-800">
          <div className="mb-3">
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Name</label>
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Food Post Template"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>
          <div className="mb-4">
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Caption</label>
            <textarea
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder="Write your caption..."
              rows={5}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-gray-400"
            />
          </div>
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <button
            onClick={createCaption}
            disabled={saving || !newName.trim() || !newText.trim()}
            className="px-4 py-2 text-sm bg-white text-gray-950 hover:bg-gray-200 rounded-lg disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Caption'}
          </button>
        </div>
      )}

      <div className="px-6 py-6">
        {loading ? (
          <p className="text-gray-600 text-sm">Loading...</p>
        ) : captions.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-gray-500 mb-4">No saved captions yet.</p>
            <p className="text-gray-600 text-sm">Save captions from the Draft Builder, or add one here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {captions.map(caption => (
              <div key={caption.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-col">
                <p className="text-sm font-medium text-white mb-2">{caption.name}</p>
                <p className="text-sm text-gray-300 whitespace-pre-wrap line-clamp-5 flex-1">{caption.text}</p>
                <button
                  onClick={() => deleteCaption(caption.id)}
                  className="mt-4 text-xs text-gray-600 hover:text-red-400 transition-colors text-left"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
