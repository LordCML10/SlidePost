import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken } from '@/lib/tiktok'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (error) {
    console.error('[TikTok callback] TikTok returned error:', error)
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`)
  }

  // Verify state to prevent CSRF
  const storedState = req.cookies.get('tt_oauth_state')?.value
  if (!state || state !== storedState) {
    console.error('[TikTok callback] State mismatch. received:', state, 'stored:', storedState)
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`)
  }

  if (!code) {
    console.error('[TikTok callback] No code in callback')
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`)
  }

  try {
    const tokens = await exchangeCodeForToken(code)

    if (!tokens.access_token) {
      console.error('[TikTok callback] Token exchange returned no access_token:', JSON.stringify(tokens))
      return NextResponse.redirect(`${appUrl}/?error=auth_failed`)
    }

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
  } catch (err) {
    console.error('[TikTok callback] Token exchange threw:', err)
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`)
  }
}
