import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { checkPublishStatus } from '@/lib/tiktok'
import { getDecryptedToken } from '@/lib/tiktokAccounts'

export const dynamic = 'force-dynamic'

// GET /api/posts/status?publish_id=xxx
// OR GET /api/posts/status  (checks all recently posted drafts, last 20)
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const activeAccountId = req.cookies.get('tt_active_account')?.value
  if (!activeAccountId) {
    return NextResponse.json({ error: 'No active TikTok account' }, { status: 400 })
  }

  let token: string
  try {
    token = await getDecryptedToken(activeAccountId, userId)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Auth failed' }, { status: 401 })
  }

  const publishId = req.nextUrl.searchParams.get('publish_id')

  // Single publish_id lookup
  if (publishId) {
    try {
      const status = await checkPublishStatus(token, publishId)
      return NextResponse.json({ data: { publish_id: publishId, ...status } })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Status check failed' }, { status: 500 })
    }
  }

  // Bulk: check last 20 posted drafts that have a publish_id
  const { data: drafts, error } = await supabaseAdmin
    .from('drafts')
    .select('id, name, publish_id, posted_at')
    .eq('posted', true)
    .not('publish_id', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results = await Promise.all(
    (drafts ?? []).map(async (draft) => {
      try {
        const status = await checkPublishStatus(token, draft.publish_id)
        return { ...draft, tiktok_status: status.status, fail_reason: status.fail_reason ?? null }
      } catch (err) {
        return { ...draft, tiktok_status: 'ERROR', fail_reason: err instanceof Error ? err.message : 'Unknown' }
      }
    })
  )

  return NextResponse.json({ data: results })
}
