import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  const body = await req.json()
  // tag_id can be a UUID string or null (to unassign)
  const { tag_id } = body

  const { data, error } = await supabaseAdmin
    .from('images')
    .update({ tag_id: tag_id ?? null })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  // Get storage_path before deleting so we can remove the file too
  const { data: image, error: fetchError } = await supabaseAdmin
    .from('images')
    .select('storage_path')
    .eq('id', id)
    .single()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  // Delete file from Supabase Storage
  const { error: storageError } = await supabaseAdmin.storage
    .from('images')
    .remove([image.storage_path])

  if (storageError) {
    // Log but don't block — still clean up the DB record
    console.error('[/api/images] Storage delete error:', storageError.message)
  }

  // Delete DB record
  const { error: dbError } = await supabaseAdmin
    .from('images')
    .delete()
    .eq('id', id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ data: { success: true } })
}
