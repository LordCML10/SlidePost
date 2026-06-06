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
    console.log('[/api/image] fetching:', src)
    const upstream = await fetch(src)

    if (!upstream.ok) {
      console.log('[/api/image] upstream failed:', upstream.status, src)
      return new NextResponse('Failed to fetch image', { status: 502 })
    }
    console.log('[/api/image] ok ct=%s cl=%s src=%s',
      upstream.headers.get('content-type'),
      upstream.headers.get('content-length'),
      src)

    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'
    const contentLength = upstream.headers.get('content-length')

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    }
    if (contentLength) headers['Content-Length'] = contentLength

    return new NextResponse(upstream.body, { headers })
  } catch {
    return new NextResponse('Proxy error', { status: 500 })
  }
}
