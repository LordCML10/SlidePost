import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { postVideo } from '@/lib/tiktok'
import { getDecryptedToken } from '@/lib/tiktokAccounts'
import type { ClipPostResult } from '@/lib/types'

export const dynamic = 'force-dynamic'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://slide-post.vercel.app'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

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
  const { clipIds } = body

  if (!Array.isArray(clipIds) || clipIds.length === 0) {
    return NextResponse.json({ error: 'Provide at least one clip ID' }, { status: 400 })
  }

  // Decrypt token once (IDOR check included)
  let token: string
  try {
    token = await getDecryptedToken(activeAccountId, userId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TikTok account not found or not authorized'
    return NextResponse.json({ error: message }, { status: 401 })
  }

  const results: ClipPostResult[] = []

  for (let i = 0; i < clipIds.length; i++) {
    const clipId = clipIds[i]

    try {
      const { data: clip, error: clipError } = await supabaseAdmin
        .from('clips')
        .select('*')
        .eq('id', clipId)
        .single()

      if (clipError || !clip) {
        results.push({ clipId, success: false, error: 'Clip not found' })
        continue
      }

      // Same proxy pattern as /api/clips and bulk-post: TikTok's PULL_FROM_URL
      // requires a verified domain, so route through our own domain rather than
      // handing TikTok a raw supabase.co URL.
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/clips/${clip.storage_path}`
      const videoUrl = `${appUrl}/api/image?src=${encodeURIComponent(publicUrl)}`

      const description = clip.caption ?? ''

      const result = await postVideo({ accessToken: token, videoUrl, description })

      await supabaseAdmin
        .from('clips')
        .update({
          status: 'posted',
          posted: true,
          posted_at: new Date().toISOString(),
          publish_id: result.publish_id,
        })
        .eq('id', clipId)

      results.push({ clipId, success: true, publish_id: result.publish_id })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[/api/clips/post] Clip ${clipId} failed:`, message)

      await supabaseAdmin
        .from('clips')
        .update({ status: 'failed' })
        .eq('id', clipId)

      results.push({ clipId, success: false, error: message })
    }

    // 2s buffer between posts — TikTok rate limit safety
    if (i < clipIds.length - 1) {
      await sleep(2000)
    }
  }

  return NextResponse.json({ data: results })
}
