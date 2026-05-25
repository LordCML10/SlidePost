import { NextRequest, NextResponse } from 'next/server'
import { initPhotoUpload, uploadPhoto } from '@/lib/tiktok'

export const dynamic = 'force-dynamic'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const MIN_PHOTOS = 2
const MAX_PHOTOS = 10

export async function POST(req: NextRequest) {
  // Auth check
  const token = req.cookies.get('tt_access_token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const caption = (formData.get('caption') as string | null) ?? ''
  const hashtags = formData.getAll('hashtags') as string[]
  const files = formData.getAll('images') as File[]

  // Validate count
  if (files.length < MIN_PHOTOS || files.length > MAX_PHOTOS) {
    return NextResponse.json(
      { error: `Upload between ${MIN_PHOTOS} and ${MAX_PHOTOS} images` },
      { status: 400 }
    )
  }

  // Validate each file (MIME type + size)
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

  // Build description: caption + hashtags
  const hashtagStr = hashtags
    .map((h) => (h.startsWith('#') ? h : `#${h}`))
    .join(' ')
  const description = [caption, hashtagStr].filter(Boolean).join('\n\n')

  try {
    // Step 1: Init upload with TikTok
    const { publish_id, upload_url } = await initPhotoUpload({
      accessToken: token,
      description,
      photoCount: files.length,
    })

    // Step 2: Upload each image's raw bytes to TikTok's upload_url
    for (const file of files) {
      const buffer = await file.arrayBuffer()
      await uploadPhoto(upload_url, buffer, file.type)
    }

    // TikTok finalizes automatically after all images are uploaded
    return NextResponse.json({ data: { publish_id } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/post] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
