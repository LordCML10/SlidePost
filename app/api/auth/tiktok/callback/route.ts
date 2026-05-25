import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken } from '@/lib/tiktok'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (error) {
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`)
  }

  // Verify state to prevent CSRF
  const storedState = req.cookies.get('tt_oauth_state')?.value
  if (!state || state !== storedState) {
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`)
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`)
  }

  try {
    const tokens = await exchangeCodeForToken(code)

    const response = NextResponse.redirect(appUrl)

    response.cookies.set('tt_access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expires_in,
      path: '/',
    })

    // Clear the state cookie
    response.cookies.delete('tt_oauth_state')

    return response
  } catch {
    console.error('TikTok OAuth callback error')
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`)
  }
}
