import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB — file goes direct to Supabase, not through Vercel

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { filename: string; contentType: string; size: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { filename, contentType, size } = body

  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    return NextResponse.json({ error: 'Only JPG, PNG, and WEBP images are allowed' }, { status: 400 })
  }
  if (size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: 'Each image must be under 25 MB' }, { status: 400 })
  }

  const ext = (filename.split('.').pop() ?? 'jpg').toLowerCase()
  const storagePath = `${Date.now()}-${crypto.randomUUID()}.${ext}`

  const { data, error } = await supabaseAdmin.storage
    .from('images')
    .createSignedUploadUrl(storagePath)

  if (error || !data) {
    console.error('[/api/upload/signed-url]', error)
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
  }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('images')
    .getPublicUrl(storagePath)

  return NextResponse.json({ signedUrl: data.signedUrl, storagePath, publicUrl })
}
