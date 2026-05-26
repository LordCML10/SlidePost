import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { postPhotoSlideshow } from '@/lib/tiktok'
import type { BulkPostResult } from '@/lib/types'

export const dynamic = 'force-dynamic'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://slide-post.vercel.app'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('tt_access_token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await req.json()
  const { draftIds } = body

  if (!Array.isArray(draftIds) || draftIds.length === 0) {
    return NextResponse.json({ error: 'Provide at least one draft ID' }, { status: 400 })
  }

  const results: BulkPostResult[] = []

  for (let i = 0; i < draftIds.length; i++) {
    const draftId = draftIds[i]

    try {
      // Fetch draft
      const { data: draft, error: draftError } = await supabaseAdmin
        .from('drafts')
        .select('*')
        .eq('id', draftId)
        .single()

      if (draftError || !draft) {
        results.push({ draftId, success: false, error: 'Draft not found' })
        continue
      }

      // Fetch images — look up by IDs then restore order from image_ids array
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

      const proxyUrls = orderedImages.map((img) =>
        `${appUrl}/api/image?src=${encodeURIComponent(img.public_url)}`
      )

      // Resolve hashtags — set takes priority over custom
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

      // Post to TikTok
      const result = await postPhotoSlideshow({ accessToken: token, imageUrls: proxyUrls, description })

      // Mark draft as posted
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
