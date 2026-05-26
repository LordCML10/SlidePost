'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const links = [
  { href: '/library', label: 'Library' },
  { href: '/drafts', label: 'Drafts' },
]

export default function Nav() {
  const pathname = usePathname()
  const [connected, setConnected] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/auth-status')
      .then(r => r.json())
      .then(d => setConnected(d.connected))
      .catch(() => setConnected(false))
  }, [])

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

      <div className="ml-auto">
        {connected === null ? null : connected ? (
          <span className="flex items-center gap-1.5 text-xs text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            TikTok connected
          </span>
        ) : (
          <a
            href="/api/auth/tiktok"
            className="text-sm bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-md transition-colors"
          >
            Connect TikTok
          </a>
        )}
      </div>
    </nav>
  )
}
