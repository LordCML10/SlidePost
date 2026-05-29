import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://slide-post.vercel.app'

// Receives one base64 JPEG from the client, stores it in Supabase Storage,
// and returns a proxy URL that TikTok can pull from.
// Uploads are done one-at-a-time to stay well under Vercel's body-size limit.
export async function POST(req: NextRequest) {
  let body: { image: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { image } = body
  if (!image || typeof image !== 'string') {
    return NextResponse.json({ error: 'Missing image (base64 string)' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(image, 'base64')
    // Use crypto.randomUUID for a collision-free path inside the images bucket
    const path = `burned/${crypto.randomUUID()}.jpg`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('images')
      .upload(path, buffer, { contentType: 'image/jpeg', upsert: false })

    if (uploadError) throw new Error(uploadError.message)

    const { data: urlData } = supabaseAdmin.storage.from('images').getPublicUrl(path)
    const proxy_url = `${appUrl}/api/image?src=${encodeURIComponent(urlData.publicUrl)}`

    return NextResponse.json({ proxy_url })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/overlay/upload]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
