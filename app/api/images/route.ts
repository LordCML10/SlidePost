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

  let query = supabaseAdmin
    .from('images')
    .select('*')
    .order('created_at', { ascending: false })

  if (tagId === 'null') {
    query = query.is('tag_id', null)
  } else if (tagId) {
    query = query.eq('tag_id', tagId)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data.map(withProxyUrl) })
}
