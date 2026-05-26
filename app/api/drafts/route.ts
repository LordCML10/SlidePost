import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('drafts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, image_ids, caption, hashtag_set_id, custom_hashtags } = body

  if (!Array.isArray(image_ids) || image_ids.length < 2 || image_ids.length > 10) {
    return NextResponse.json({ error: 'Provide between 2 and 10 images' }, { status: 400 })
  }
  if (!caption || typeof caption !== 'string' || !caption.trim()) {
    return NextResponse.json({ error: 'Caption is required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('drafts')
    .insert({
      name: name ?? null,
      image_ids,
      caption: caption.trim(),
      hashtag_set_id: hashtag_set_id ?? null,
      custom_hashtags: custom_hashtags ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
