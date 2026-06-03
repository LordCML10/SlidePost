import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const MAX_PHOTOS = 10 // per batch — frontend batches larger imports

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://slide-post.vercel.app'

export async function POST(req: NextRequest) {
  // Verify Clerk session inside the handler — middleware redirect loses FormData
  // for POST requests, so we guard here and return JSON on failure instead.
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const files = formData.getAll('images') as File[]

  if (files.length < 1 || files.length > MAX_PHOTOS) {
    return NextResponse.json(
      { error: `Upload between 1 and ${MAX_PHOTOS} images at a time` },
      { status: 400 }
    )
  }

  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only JPG, PNG, and WEBP images are allowed' },
        { status: 400 }
      )
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Each image must be under 5MB' },
        { status: 400 }
      )
    }
  }

  try {
    const images = await Promise.all(
      files.map(async (file) => {
        const ext = file.name.split('.').pop() ?? 'jpg'
        const storagePath = `${Date.now()}-${crypto.randomUUID()}.${ext}`
        const buf = await file.arrayBuffer()

        // Upload to Supabase Storage
        const { error: uploadError } = await supabaseAdmin.storage
          .from('images')
          .upload(storagePath, buf, { contentType: file.type, upsert: false })

        if (uploadError) throw new Error(uploadError.message)

        // Get public URL (no suffix collision possible — UUID in path)
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from('images')
          .getPublicUrl(storagePath)

        // Save metadata to DB
        const { data: inserted, error: dbError } = await supabaseAdmin
          .from('images')
          .insert({
            filename: file.name || storagePath,
            storage_path: storagePath,
            public_url: publicUrl,
          })
          .select()

        if (dbError) throw new Error(dbError.message)
        if (!inserted || inserted.length === 0) {
          throw new Error('Image saved to storage but DB insert returned no record — check Supabase service role key')
        }
        const imageRecord = inserted[0]

        // Compute proxy_url at query time — never stored in DB
        return {
          ...imageRecord,
          proxy_url: `${appUrl}/api/image?src=${encodeURIComponent(publicUrl)}`,
        }
      })
    )

    return NextResponse.json({ data: { images } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/upload] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
