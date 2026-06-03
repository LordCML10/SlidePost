import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { filename: string; storagePath: string; publicUrl: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { filename, storagePath, publicUrl } = body

  const { data: inserted, error: dbError } = await supabaseAdmin
    .from('images')
    .insert({
      filename: filename || storagePath,
      storage_path: storagePath,
      public_url: publicUrl,
    })
    .select()
    .single()

  if (dbError || !inserted) {
    console.error('[/api/upload/complete]', dbError)
    return NextResponse.json({ error: dbError?.message ?? 'Failed to save image' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
  return NextResponse.json({
    data: {
      ...inserted,
      proxy_url: `${appUrl}/api/image?src=${encodeURIComponent(publicUrl)}`,
    },
  })
}
