const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/'
const TIKTOK_POST_URL = 'https://open.tiktokapis.com/v2/post/publish/content/init/'

export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string
  open_id: string
  expires_in: number
  refresh_token: string
  refresh_expires_in: number
  scope: string
}> {
  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.TIKTOK_REDIRECT_URI!,
    }),
  })

  const data = await res.json()

  if (!res.ok || data.error) {
    throw new Error(data.error_description ?? 'Token exchange failed')
  }

  return data
}

export async function postPhotoSlideshow({
  accessToken,
  imageUrls,
  description,
}: {
  accessToken: string
  imageUrls: string[]
  description: string
}) {
  const res = await fetch(TIKTOK_POST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      post_info: {
        description,
        privacy_level: 'SELF_ONLY',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        photo_cover_index: 0,
        photo_images: imageUrls,
      },
      post_mode: 'MEDIA_UPLOAD',
      media_type: 'PHOTO',
    }),
  })

  const text = await res.text()
  console.log('[TikTok post] status:', res.status, 'body:', text)

  let data: Record<string, unknown>
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`TikTok returned non-JSON (${res.status}): ${text.slice(0, 200)}`)
  }

  if (!res.ok || (data.error as Record<string, unknown>)?.code !== 'ok') {
    throw new Error(`TikTok error: ${JSON.stringify(data.error ?? data)}`)
  }

  return data.data as { publish_id: string }
}

export async function postVideo({
  accessToken,
  videoUrl,
  description,
}: {
  accessToken: string
  videoUrl: string
  description: string
}) {
  const res = await fetch(TIKTOK_POST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      post_info: {
        title: description,
        privacy_level: 'SELF_ONLY',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: videoUrl,
      },
      post_mode: 'MEDIA_UPLOAD',
      media_type: 'VIDEO',
    }),
  })

  const text = await res.text()
  console.log('[TikTok post video] status:', res.status, 'body:', text)

  let data: Record<string, unknown>
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`TikTok returned non-JSON (${res.status}): ${text.slice(0, 200)}`)
  }

  if (!res.ok || (data.error as Record<string, unknown>)?.code !== 'ok') {
    throw new Error(`TikTok error: ${JSON.stringify(data.error ?? data)}`)
  }

  return data.data as { publish_id: string }
}

// Check the processing / publish status of a post by its publish_id.
export async function checkPublishStatus(accessToken: string, publishId: string): Promise<{
  status: string
  fail_reason?: string
  publicaly_available_post_id?: string[]
}> {
  const res = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ publish_id: publishId }),
  })
  const data = await res.json()
  console.log('[checkPublishStatus]', publishId, JSON.stringify(data))
  if (!res.ok || data.error?.code !== 'ok') {
    throw new Error(`TikTok status error: ${JSON.stringify(data.error ?? data)}`)
  }
  return data.data as { status: string; fail_reason?: string; publicaly_available_post_id?: string[] }
}

// Refresh an expired TikTok access token using the stored refresh token.
export async function refreshTikTokToken(refreshToken: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
  refresh_expires_in: number
}> {
  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  const data = await res.json()
  if (!res.ok || data.error) {
    throw new Error(data.error_description ?? 'Token refresh failed — please reconnect your TikTok account.')
  }
  return data
}

// Fetch TikTok display name and avatar (requires user.info.basic scope).
// Returns nulls if the app doesn't have the scope or the call fails — non-fatal.
export async function fetchTikTokUserInfo(
  accessToken: string
): Promise<{ display_name: string | null; avatar_url: string | null }> {
  try {
    const res = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) return { display_name: null, avatar_url: null }
    const json = await res.json()
    if (json.error?.code !== 'ok') return { display_name: null, avatar_url: null }
    return {
      display_name: json.data?.user?.display_name ?? null,
      avatar_url: json.data?.user?.avatar_url ?? null,
    }
  } catch {
    return { display_name: null, avatar_url: null }
  }
}
