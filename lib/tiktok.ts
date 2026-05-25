const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/'
const TIKTOK_PHOTO_INIT_URL = 'https://open.tiktokapis.com/v2/post/publish/inbox/photo/init/'

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

// Step 1: Init the upload — TikTok returns a publish_id and upload_url
export async function initPhotoUpload({
  accessToken,
  description,
  photoCount,
}: {
  accessToken: string
  description: string
  photoCount: number
}): Promise<{ publish_id: string; upload_url: string }> {
  const res = await fetch(TIKTOK_PHOTO_INIT_URL, {
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
        source: 'FILE_UPLOAD',
        photo_count: photoCount,
      },
      post_mode: 'MEDIA_UPLOAD',
      media_type: 'PHOTO',
    }),
  })

  const data = await res.json()

  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? 'Failed to initialize TikTok photo upload')
  }

  return {
    publish_id: data.data.publish_id,
    upload_url: data.data.upload_url,
  }
}

// Step 2: Upload one photo's raw bytes to the upload_url TikTok returned
export async function uploadPhoto(
  uploadUrl: string,
  buffer: ArrayBuffer,
  mimeType: string
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(buffer.byteLength),
    },
    body: buffer,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Photo upload failed (${res.status}): ${text}`)
  }
}
