'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { UserButton, useAuth } from '@clerk/nextjs'
import type { TikTokAccount } from '@/lib/types'

const links = [
  { href: '/library', label: 'Library' },
  { href: '/drafts', label: 'Drafts' },
  { href: '/captions', label: 'Captions' },
  { href: '/overlay', label: 'Overlay' },
]

export default function Nav() {
  const pathname = usePathname()
  const { isLoaded, isSignedIn } = useAuth()

  const [accounts, setAccounts] = useState<TikTokAccount[]>([])
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fetch TikTok accounts whenever the user is signed in
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    fetch('/api/auth/tiktok/accounts')
      .then(r => r.json())
      .then(d => {
        setAccounts(d.accounts ?? [])
        setActiveAccountId(d.activeAccountId ?? null)
      })
      .catch(() => {})
  }, [isLoaded, isSignedIn])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function switchAccount(id: string) {
    setMenuOpen(false)
    const res = await fetch(`/api/auth/tiktok/accounts/${id}`, { method: 'PATCH' })
    if (res.ok) setActiveAccountId(id)
  }

  async function disconnectAccount(id: string) {
    const res = await fetch(`/api/auth/tiktok/accounts/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setAccounts(prev => prev.filter(a => a.id !== id))
      if (activeAccountId === id) {
        const remaining = accounts.filter(a => a.id !== id)
        setActiveAccountId(remaining[0]?.id ?? null)
      }
    }
  }

  const activeAccount = accounts.find(a => a.id === activeAccountId) ?? null

  function accountLabel(acc: TikTokAccount) {
    return acc.display_name ?? `TikTok #${acc.open_id.slice(-6)}`
  }

  return (
    <nav className="fixed top-0 inset-x-0 z-50 h-14 bg-gray-950 border-b border-gray-800 flex items-center px-6 gap-6">
      <span className="font-bold text-white text-base tracking-tight">SlidePost</span>

      <div className="flex gap-1">
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              pathname.startsWith(link.href)
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-3">
        {isLoaded && isSignedIn && (
          <>
            {/* TikTok account switcher */}
            {accounts.length === 0 ? (
              <a
                href="/api/auth/tiktok"
                className="text-sm bg-white hover:bg-gray-200 text-gray-950 px-3 py-1.5 rounded-md transition-colors"
              >
                Connect TikTok
              </a>
            ) : (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors"
                >
                  {activeAccount?.avatar_url ? (
                    <img
                      src={activeAccount.avatar_url}
                      alt=""
                      className="w-4 h-4 rounded-full object-cover"
                    />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
                  )}
                  <span>{activeAccount ? accountLabel(activeAccount) : 'TikTok'}</span>
                  <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 bg-gray-900 border border-gray-700 rounded-lg min-w-[220px] py-1 z-50">
                    {accounts.map(acc => (
                      <div
                        key={acc.id}
                        className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-800 transition-colors group"
                      >
                        {acc.avatar_url ? (
                          <img src={acc.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-700 shrink-0 flex items-center justify-center">
                            <svg className="w-3 h-3 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.54V6.79a4.85 4.85 0 01-1.02-.1z" />
                            </svg>
                          </div>
                        )}
                        <button
                          onClick={() => switchAccount(acc.id)}
                          className="flex-1 text-left text-sm text-white truncate"
                        >
                          {accountLabel(acc)}
                        </button>
                        {acc.id === activeAccountId && (
                          <svg className="w-3.5 h-3.5 text-white shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); disconnectAccount(acc.id) }}
                          className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                          title="Disconnect"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}

                    <div className="border-t border-gray-800 mt-1 pt-1">
                      <a
                        href="/api/auth/tiktok"
                        className="flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Connect another account
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Clerk user button — handles sign out, profile, etc. */}
            <UserButton />
          </>
        )}
      </div>
    </nav>
  )
}
