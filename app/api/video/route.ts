import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

// Proxy video clips from Supabase Storage through our verified domain — same
// "verified domain" reasoning as /api/image (TikTok's PULL_FROM_URL requires URLs
// from a domain you've verified in the TikTok Developer Portal; we can verify
// slide-post.vercel.app but not supabase.co).
//
// This is a SEPARATE route from /api/image on purpose: TikTok's video processor
// behaves differently from its image fetcher — it issues ranged byte requests
// (Range: bytes=...) to stream/validate the file, and likely a HEAD pre-check
// before it ever GETs the body. Bolting that support onto /api/image risked
// subtly breaking the working photo-slideshow flow, so video gets its own proxy
// that forwards Range and implements HEAD, while /api/image stays untouched.
async function proxyVideo(req: NextRequest, method: 'GET' | 'HEAD') {
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
    const range = req.headers.get('range')
    console.log(`[/api/video] ${method} fetching:`, src, 'range:', range)

    const upstream = await fetch(src, {
      method,
      headers: range ? { Range: range } : undefined,
    })

    if (!upstream.ok && upstream.status !== 206) {
      console.log('[/api/video] upstream failed:', upstream.status, src)
      return new NextResponse('Failed to fetch video', { status: 502 })
    }

    // Force video/mp4. Supabase Storage serves these clips as text/plain (the
    // uploader didn't set a content-type), and TikTok rejects a video whose
    // Content-Type isn't a video MIME. This route only ever serves mp4 clips, so
    // overriding is safe and fixes already-uploaded clips without re-uploading.
    const contentType = 'video/mp4'
    const contentLength = upstream.headers.get('content-length')
    const contentRange = upstream.headers.get('content-range')
    const acceptRanges = upstream.headers.get('accept-ranges')

    console.log('[/api/video] ok status=%s ct=%s cl=%s cr=%s src=%s',
      upstream.status, contentType, contentLength, contentRange, src)

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      // Do NOT let the CDN cache this. TikTok pulls the file in hundreds of small
      // byte-ranges; Vercel's edge cache keys on URL and does not vary on the Range
      // header, so a cached response for one range was being served for a DIFFERENT
      // range request — TikTok reassembled mismatched chunks into a corrupt file and
      // failed the publish with "internal". no-store forces every range to be served
      // fresh and correct straight from Supabase.
      'Cache-Control': 'no-store',
      'Accept-Ranges': acceptRanges ?? 'bytes',
    }
    if (contentLength) headers['Content-Length'] = contentLength
    if (contentRange) headers['Content-Range'] = contentRange

    return new NextResponse(method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      headers,
    })
  } catch {
    return new NextResponse('Proxy error', { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return proxyVideo(req, 'GET')
}

export async function HEAD(req: NextRequest) {
  return proxyVideo(req, 'HEAD')
}
