import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://slide-post.vercel.app'

// Receives one base64 JPEG, stores it in Supabase Storage.
// Pass save:true to also insert a row in the images table so the result
// can be referenced by a draft (returns image_id in that case).
export async function POST(req: NextRequest) {
  let body: { image: string; save?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { image, save = false } = body
  if (!image || typeof image !== 'string') {
    return NextResponse.json({ error: 'Missing image (base64 string)' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(image, 'base64')
    const uuid = crypto.randomUUID()
    const storagePath = `burned/${uuid}.jpg`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('images')
      .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: false })

    if (uploadError) throw new Error(uploadError.message)

    const { data: urlData } = supabaseAdmin.storage.from('images').getPublicUrl(storagePath)
    const proxy_url = `${appUrl}/api/image?src=${encodeURIComponent(urlData.publicUrl)}`

    if (save) {
      // Also insert a row in the images table so the file gets an image_id
      // usable by the drafts system
      const { data: imgRecord, error: dbError } = await supabaseAdmin
        .from('images')
        .insert({
          filename: `burned_${uuid}.jpg`,
          storage_path: storagePath,
          public_url: urlData.publicUrl,
          tag_id: null,
          user_id: null,
        })
        .select('id')
        .maybeSingle()

      if (dbError || !imgRecord) {
        throw new Error(dbError?.message ?? 'Failed to create image record')
      }

      return NextResponse.json({ proxy_url, image_id: imgRecord.id as string })
    }

    return NextResponse.json({ proxy_url })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/overlay/upload]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
