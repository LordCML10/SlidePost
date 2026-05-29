import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Returns the display name + avatar of the connected TikTok account
// so we can verify which account posts are being sent to.
export async function GET(req: NextRequest) {
  const token = req.cookies.get('tt_access_token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Not connected' }, { status: 401 })
  }

  const res = await fetch(
    'https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url,open_id',
    { headers: { Authorization: `Bearer ${token}` } }
  )

  const data = await res.json()
  console.log('[/api/auth/tiktok/user]', JSON.stringify(data))

  if (!res.ok || data.error?.code !== 'ok') {
    return NextResponse.json({ error: data.error?.message ?? 'TikTok API error', raw: data }, { status: 500 })
  }

  return NextResponse.json({
    display_name: data.data?.user?.display_name,
    avatar_url: data.data?.user?.avatar_url,
    open_id: data.data?.user?.open_id,
  })
}
