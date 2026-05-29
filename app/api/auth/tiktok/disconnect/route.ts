import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Clears the TikTok access token cookie so the user can re-authenticate
// with a different account.
export async function POST() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = NextResponse.redirect(appUrl)
  res.cookies.delete('tt_access_token')
  return res
}
