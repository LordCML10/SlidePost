import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { listTikTokAccounts } from '@/lib/tiktokAccounts'

export const dynamic = 'force-dynamic'

// Returns the current user's connected TikTok accounts plus the active account ID.
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const accounts = await listTikTokAccounts(userId)
    const activeAccountId = req.cookies.get('tt_active_account')?.value ?? null

    // If the stored active account no longer exists (e.g. was deleted), fall
    // back to the first account in the list
    const validActive =
      activeAccountId && accounts.some(a => a.id === activeAccountId)
        ? activeAccountId
        : accounts[0]?.id ?? null

    return NextResponse.json({ accounts, activeAccountId: validActive })
  } catch (err) {
    console.error('[/api/auth/tiktok/accounts GET]', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
