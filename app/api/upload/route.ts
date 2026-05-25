import { NextRequest, NextResponse } from 'next/server'
import { uploadImageToBlob } from '@/lib/blob'

export const dynamic = 'force-dynamic'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const MIN_PHOTOS = 2
const MAX_PHOTOS = 10

export async function POST(req: NextRequest) {
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

  const files = formData.getAll('images') as File[]

  if (files.length < MIN_PHOTOS || files.length > MAX_PHOTOS) {
    return NextResponse.json(
      { error: `Upload between ${MIN_PHOTOS} and ${MAX_PHOTOS} images` },
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
    const urls = await Promise.all(
      files.map((file) =>
        file.arrayBuffer().then((buf) =>
          uploadImageToBlob(file.name || `image-${Date.now()}`, buf, file.type)
        )
      )
    )
    return NextResponse.json({ data: { urls } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/upload] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
