import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Proxy images from Vercel Blob through our verified domain.
// TikTok requires PULL_FROM_URL images to come from a verified domain —
// we can't verify vercel-storage.com, but we can verify slide-post.vercel.app.
export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get('src')

  if (!src) {
    return new NextResponse('Missing src param', { status: 400 })
  }

  // Only allow proxying from our own Vercel Blob store
  if (!src.startsWith('https://') || !src.includes('vercel-storage.com')) {
    return new NextResponse('Invalid src', { status: 400 })
  }

  try {
    const upstream = await fetch(src)

    if (!upstream.ok) {
      return new NextResponse('Failed to fetch image', { status: 502 })
    }

    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'

    return new NextResponse(upstream.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return new NextResponse('Proxy error', { status: 500 })
  }
}
