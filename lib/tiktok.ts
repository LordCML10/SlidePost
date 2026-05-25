const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/'
const TIKTOK_POST_URL = 'https://open.tiktokapis.com/v2/post/publish/content/init/'

export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string
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

  return res.json()
}
