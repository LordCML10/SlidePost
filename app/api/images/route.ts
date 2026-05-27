import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://slide-post.vercel.app'

function withProxyUrl(image: Record<string, unknown>) {
  return {
    ...image,
    proxy_url: `${appUrl}/api/image?src=${encodeURIComponent(image.public_url as string)}`,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const tagId = searchParams.get('tag_id')
  const ids = searchParams.get('ids') // comma-separated UUIDs

  let query = supabaseAdmin
    .from('images')
    .select('*')
    .order('created_at', { ascending: false })

  if (ids) {
    // Fetch specific images by ID (used by builder to load selected images)
    query = query.in('id', ids.split(',').filter(Boolean))
  } else if (tagId === 'null') {
    query = query.is('tag_id', null)
  } else if (tagId) {
    query = query.eq('tag_id', tagId)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'MISSING'
  const keySnippet = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'MISSING').slice(-8)
  console.log(`[/api/images] url=${supabaseUrl} key_tail=${keySnippet}`)

  const { data, error } = await query

  if (error) {
    console.error('[/api/images] Supabase error:', JSON.stringify(error))
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  console.log('[/api/images] rows returned:', data?.length ?? 0)
  return NextResponse.json({ data: (data ?? []).map(withProxyUrl) })
}
