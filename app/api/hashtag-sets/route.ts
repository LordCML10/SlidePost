import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('hashtag_sets')
    .select('*')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, hashtags } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Set name is required' }, { status: 400 })
  }
  if (!Array.isArray(hashtags) || hashtags.length === 0) {
    return NextResponse.json({ error: 'At least one hashtag is required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('hashtag_sets')
    .insert({ name: name.trim(), hashtags })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
