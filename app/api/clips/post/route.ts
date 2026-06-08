import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { postVideo } from '@/lib/tiktok'
import { getDecryptedToken } from '@/lib/tiktokAccounts'
import type { ClipPostResult } from '@/lib/types'

export const dynamic = 'force-dynamic'
// Node runtime (not edge): we download the full clip into memory and stream chunked
// PUT uploads to TikTok — needs Node's fetch/Buffer behavior, not the edge runtime.
export const runtime = 'nodejs'
// Clips can be tens of MB; give the upload room beyond the default function timeout.
export const maxDuration = 60

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

      // Download the clip bytes from Storage and push them straight to TikTok via
      // FILE_UPLOAD. We deliberately do NOT use PULL_FROM_URL (have TikTok fetch our
      // /api/video proxy) — that path consistently failed with fail_reason "internal"
      // despite byte-perfect delivery. FILE_UPLOAD removes the proxy/CDN/pull layer.
      const { data: blob, error: dlError } = await supabaseAdmin.storage
        .from('clips')
        .download(clip.storage_path)

      if (dlError || !blob) {
        results.push({ clipId, success: false, error: 'Failed to download clip from storage' })
        continue
      }

      const video = new Uint8Array(await blob.arrayBuffer())
      const result = await postVideo({ accessToken: token, video, caption: clip.caption ?? undefined })

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
