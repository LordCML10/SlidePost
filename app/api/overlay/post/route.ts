import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { postPhotoSlideshow } from '@/lib/tiktok'
import { getDecryptedToken } from '@/lib/tiktokAccounts'

export const dynamic = 'force-dynamic'

// Receives already-uploaded proxy URLs + TikTok caption and posts the slideshow.
// Images are uploaded individually beforehand via /api/overlay/upload to stay
// within Vercel's per-request body-size limit.
// The active TikTok account is read from the httpOnly tt_active_account cookie.
export async function POST(req: NextRequest) {
  // Auth — middleware already checked Clerk session, but we verify here too
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const activeAccountId = req.cookies.get('tt_active_account')?.value
  if (!activeAccountId) {
    return NextResponse.json(
      { error: 'No active TikTok account — connect one using "Connect TikTok" in the nav.' },
      { status: 401 }
    )
  }

  let body: {
    proxy_urls: string[]
    caption: string
    hashtag_set_id?: string | null
    custom_hashtags?: string[] | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { proxy_urls, caption, hashtag_set_id, custom_hashtags } = body

  if (!Array.isArray(proxy_urls) || proxy_urls.length < 2 || proxy_urls.length > 10) {
    return NextResponse.json({ error: 'Need 2–10 image URLs' }, { status: 400 })
  }
  if (!caption?.trim()) {
    return NextResponse.json({ error: 'Caption is required' }, { status: 400 })
  }

  try {
    // Decrypt access token (IDOR check included — verifies userId owns the account)
    const token = await getDecryptedToken(activeAccountId, userId)

    // Resolve hashtags — set takes priority over custom
    let hashtags: string[] = []
    if (hashtag_set_id) {
      const { data: set } = await supabaseAdmin
        .from('hashtag_sets')
        .select('hashtags')
        .eq('id', hashtag_set_id)
        .maybeSingle()
      if (set) hashtags = set.hashtags
    } else if (custom_hashtags?.length) {
      hashtags = custom_hashtags
    }

    const hashtagStr = hashtags
      .map(h => (h.startsWith('#') ? h : `#${h}`))
      .join(' ')
    const description = [caption.trim(), hashtagStr].filter(Boolean).join('\n\n')

    const result = await postPhotoSlideshow({
      accessToken: token,
      imageUrls: proxy_urls,
      description,
    })

    return NextResponse.json({ success: true, publish_id: result.publish_id })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/overlay/post]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
