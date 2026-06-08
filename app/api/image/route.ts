import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

// Proxy images from Supabase Storage through our verified domain.
// TikTok requires PULL_FROM_URL images to come from a verified domain —
// we can't verify supabase.co, but we can verify slide-post.vercel.app.
export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get('src')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  if (!src) {
    return new NextResponse('Missing src param', { status: 400 })
  }

  // Only allow proxying from our own Supabase Storage project
  if (!supabaseUrl || !src.startsWith(supabaseUrl)) {
    return new NextResponse('Invalid src', { status: 400 })
  }

  try {
    // Forward Range so video pulls (TikTok PULL_FROM_URL) work — TikTok's video
    // processor issues ranged requests to fetch/validate the file in chunks, and a
    // proxy that always returns the full body with 200 (no Accept-Ranges/206/
    // Content-Range) makes that processing fail with a generic "internal" error.
    const range = req.headers.get('range')
    console.log('[/api/image] fetching:', src, 'range:', range)
    const upstream = await fetch(src, range ? { headers: { Range: range } } : undefined)

    if (!upstream.ok && upstream.status !== 206) {
      console.log('[/api/image] upstream failed:', upstream.status, src)
      return new NextResponse('Failed to fetch image', { status: 502 })
    }
    console.log('[/api/image] ok status=%s ct=%s cl=%s cr=%s src=%s',
      upstream.status,
      upstream.headers.get('content-type'),
      upstream.headers.get('content-length'),
      upstream.headers.get('content-range'),
      src)

    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'
    const contentLength = upstream.headers.get('content-length')
    const contentRange = upstream.headers.get('content-range')
    const acceptRanges = upstream.headers.get('accept-ranges')

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Accept-Ranges': acceptRanges ?? 'bytes',
    }
    if (contentLength) headers['Content-Length'] = contentLength
    if (contentRange) headers['Content-Range'] = contentRange

    return new NextResponse(upstream.body, { status: upstream.status, headers })
  } catch {
    return new NextResponse('Proxy error', { status: 500 })
  }
}
