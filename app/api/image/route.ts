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
    const upstream = await fetch(src)

    if (!upstream.ok) {
      return new NextResponse('Failed to fetch image', { status: 502 })
    }

    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'

    // Buffer the full image before responding — forces a proper Content-Length
    // header with no chunked transfer encoding. TikTok's PULL_FROM_URL fetcher
    // may not handle chunked responses correctly, causing incomplete reads that
    // fail the picture_size_check.
    const buffer = await upstream.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return new NextResponse('Proxy error', { status: 500 })
  }
}
