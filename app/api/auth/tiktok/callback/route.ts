import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { exchangeCodeForToken, fetchTikTokUserInfo } from '@/lib/tiktok'
import { saveTikTokAccount } from '@/lib/tiktokAccounts'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Derive origin from the request so this works even if NEXT_PUBLIC_APP_URL
  // is not set — avoids post-OAuth redirects landing on localhost in production.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin

  if (error) {
    console.error('[TikTok callback] TikTok returned error:', error)
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`)
  }

  // Verify CSRF state
  const storedState = req.cookies.get('tt_oauth_state')?.value
  if (!state || state !== storedState) {
    console.error('[TikTok callback] State mismatch. received:', state, 'stored:', storedState)
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`)
  }

  if (!code) {
    console.error('[TikTok callback] No code in callback')
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`)
  }

  // Require an authenticated Clerk session — the browser keeps the session
  // cookie across the TikTok OAuth redirect, so this will be present.
  const { userId } = await auth()
  if (!userId) {
    console.error('[TikTok callback] No Clerk session — user may have been signed out')
    return NextResponse.redirect(`${appUrl}/sign-in?error=session_expired`)
  }

  try {
    const tokens = await exchangeCodeForToken(code)

    if (!tokens.access_token || !tokens.open_id) {
      console.error('[TikTok callback] Token exchange returned no access_token or open_id:', JSON.stringify(tokens))
      return NextResponse.redirect(`${appUrl}/?error=auth_failed`)
    }

    // Fetch display name + avatar (best-effort — requires user.info.basic scope)
    const userInfo = await fetchTikTokUserInfo(tokens.access_token)

    // Save (or update) the account in the DB with the encrypted token
    const account = await saveTikTokAccount({
      userId,
      openId: tokens.open_id,
      accessToken: tokens.access_token,
      displayName: userInfo.display_name,
      avatarUrl: userInfo.avatar_url,
      expiresIn: tokens.expires_in,
    })

    // Set the newly connected account as the active account
    const response = NextResponse.redirect(appUrl)
    response.cookies.delete('tt_oauth_state')
    response.cookies.set('tt_active_account', account.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    })

    return response
  } catch (err) {
    console.error('[TikTok callback] Error:', err)
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`)
  }
}
