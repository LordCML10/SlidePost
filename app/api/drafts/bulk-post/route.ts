import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { postPhotoSlideshow } from '@/lib/tiktok'
import { getDecryptedToken } from '@/lib/tiktokAccounts'
import type { BulkPostResult } from '@/lib/types'

export const dynamic = 'force-dynamic'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://slide-post.vercel.app'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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

  const body = await req.json()
  const { draftIds } = body

  if (!Array.isArray(draftIds) || draftIds.length === 0) {
    return NextResponse.json({ error: 'Provide at least one draft ID' }, { status: 400 })
  }

  // Decrypt token once (IDOR check included)
  let token: string
  try {
    token = await getDecryptedToken(activeAccountId, userId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TikTok account not found or not authorized'
    return NextResponse.json({ error: message }, { status: 401 })
  }

  const results: BulkPostResult[] = []

  for (let i = 0; i < draftIds.length; i++) {
    const draftId = draftIds[i]

    try {
      const { data: draft, error: draftError } = await supabaseAdmin
        .from('drafts')
        .select('*')
        .eq('id', draftId)
        .single()

      if (draftError || !draft) {
        results.push({ draftId, success: false, error: 'Draft not found' })
        continue
      }

      const { data: images, error: imagesError } = await supabaseAdmin
        .from('images')
        .select('id, public_url')
        .in('id', draft.image_ids)

      if (imagesError || !images) {
        results.push({ draftId, success: false, error: 'Failed to fetch images' })
        continue
      }

      const imageMap = new Map(images.map((img: { id: string; public_url: string }) => [img.id, img]))
      const orderedImages = (draft.image_ids as string[])
        .map((id) => imageMap.get(id))
        .filter(Boolean) as { id: string; public_url: string }[]

      // TikTok's PULL_FROM_URL requires URLs from a domain you've verified in the
      // TikTok Developer Portal. Route through our proxy so all image URLs come
      // from the app's own domain (which you verify once, not Supabase's domain).
      const imageUrls = orderedImages.map((img) =>
        `${appUrl}/api/image?src=${encodeURIComponent(img.public_url)}`
      )

      let hashtags: string[] = []
      if (draft.hashtag_set_id) {
        const { data: set } = await supabaseAdmin
          .from('hashtag_sets')
          .select('hashtags')
          .eq('id', draft.hashtag_set_id)
          .single()
        if (set) hashtags = set.hashtags
      } else if (draft.custom_hashtags) {
        hashtags = draft.custom_hashtags
      }

      const hashtagStr = hashtags
        .map((h: string) => (h.startsWith('#') ? h : `#${h}`))
        .join(' ')
      const description = [draft.caption, hashtagStr].filter(Boolean).join('\n\n')

      const result = await postPhotoSlideshow({ accessToken: token, imageUrls, description })

      await supabaseAdmin
        .from('drafts')
        .update({
          posted: true,
          posted_at: new Date().toISOString(),
          publish_id: result.publish_id,
        })
        .eq('id', draftId)

      results.push({ draftId, success: true, publish_id: result.publish_id })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[/api/drafts/bulk-post] Draft ${draftId} failed:`, message)
      results.push({ draftId, success: false, error: message })
    }

    // 2s buffer between posts — TikTok rate limit safety
    if (i < draftIds.length - 1) {
      await sleep(2000)
    }
  }

  return NextResponse.json({ data: results })
}
