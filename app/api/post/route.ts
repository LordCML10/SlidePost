import { NextRequest, NextResponse } from 'next/server'
import { postPhotoSlideshow } from '@/lib/tiktok'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const token = req.cookies.get('tt_access_token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: { imageUrls: string[]; caption: string; hashtags: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { imageUrls, caption, hashtags } = body

  if (!Array.isArray(imageUrls) || imageUrls.length < 2 || imageUrls.length > 10) {
    return NextResponse.json({ error: 'Provide between 2 and 10 image URLs' }, { status: 400 })
  }

  const hashtagStr = hashtags
    .map((h) => (h.startsWith('#') ? h : `#${h}`))
    .join(' ')
  const description = [caption, hashtagStr].filter(Boolean).join('\n\n')

  try {
    const result = await postPhotoSlideshow({ accessToken: token, imageUrls, description })
    return NextResponse.json({ data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/post] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
