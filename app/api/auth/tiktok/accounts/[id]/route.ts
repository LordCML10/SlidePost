import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { deleteTikTokAccount, verifyAccountOwnership } from '@/lib/tiktokAccounts'

export const dynamic = 'force-dynamic'

// PATCH — set this account as the active one (updates httpOnly cookie)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const owns = await verifyAccountOwnership(id, userId)
  if (!owns) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('tt_active_account', id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/',
  })
  return response
}

// DELETE — disconnect a TikTok account
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    await deleteTikTokAccount(id, userId)

    const response = NextResponse.json({ ok: true })
    // Clear the active account cookie if the user deleted the active account
    if (req.cookies.get('tt_active_account')?.value === id) {
      response.cookies.delete('tt_active_account')
    }
    return response
  } catch (err) {
    console.error('[/api/auth/tiktok/accounts DELETE]', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
