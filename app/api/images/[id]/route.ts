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
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  // Get storage_path before deleting — use maybeSingle so 0 rows returns null, not an error
  const { data: image } = await supabaseAdmin
    .from('images')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle()

  // Best-effort storage delete (only if we found the record)
  if (image?.storage_path) {
    const { error: storageError } = await supabaseAdmin.storage
      .from('images')
      .remove([image.storage_path])

    if (storageError) {
      console.error('[/api/images] Storage delete error:', storageError.message)
    }
  }

  // Delete DB record
  const { error: dbError } = await supabaseAdmin
    .from('images')
    .delete()
    .eq('id', id)

  if (dbError) {
    console.error('[/api/images] DB delete error:', JSON.stringify(dbError))
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  // Verify the row is actually gone — .delete().select() can silently return empty
  // in some Supabase configs even when the delete worked, so we check separately
  const { data: stillExists } = await supabaseAdmin
    .from('images')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (stillExists) {
    console.error('[/api/images] Delete ran without error but row still exists:', id)
    return NextResponse.json({ error: 'Delete did not remove the row — check Supabase logs' }, { status: 500 })
  }

  return NextResponse.json({ data: { success: true } })
}
