import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://slide-post.vercel.app'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

// Clips are uploaded to the public `clips` Storage bucket by the local ClipR pipeline.
// We compute the public Storage URL here (never stored in DB) and proxy it through our
// own verified domain — same pattern as /api/images — since TikTok's PULL_FROM_URL
// requires a verified domain and we can't verify supabase.co.
function withProxyUrl(clip: Record<string, unknown>) {
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/clips/${clip.storage_path}`
  return {
    ...clip,
    // Dedicated video proxy (Range/HEAD-aware) — kept separate from /api/image so
    // changes for TikTok's video pull behavior can't affect the image-post flow.
    proxy_url: `${appUrl}/api/video?src=${encodeURIComponent(publicUrl)}`,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')

  let query = supabaseAdmin
    .from('clips')
    .select('*')
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('[/api/clips] Supabase error:', JSON.stringify(error))
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: (data ?? []).map(withProxyUrl) })
}
