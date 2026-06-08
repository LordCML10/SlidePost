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

// Sends the video to the user's TikTok inbox/drafts (the "send to inbox" flow) — they
// get a notification, open the app, and finish posting (caption, privacy, cover, etc.)
// themselves. Requires the `video.upload` scope (not `video.publish`, which DIRECT_POST
// needs).
//
// We use FILE_UPLOAD (push the bytes straight to TikTok), NOT PULL_FROM_URL. PULL_FROM_URL
// makes TikTok's pull infrastructure fetch the clip from our Vercel proxy, and that path
// consistently failed with the generic fail_reason "internal" even after the delivery
// was proven byte-perfect (full file pulled, correct ranges, video/mp4, faststart, no
// redirects). FILE_UPLOAD removes the proxy, the CDN, and TikTok's pull layer entirely.
const TIKTOK_INBOX_VIDEO_URL = 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/'

const MAX_CHUNK = 64 * 1024 * 1024 // TikTok's max chunk size

// Split a video of `size` bytes into TikTok-compliant chunk boundaries.
// Rules: a single chunk for files up to 64MB (chunk_size == video_size); for larger
// files, 64MB chunks with the FINAL chunk absorbing the remainder (TikTok allows the
// final chunk to exceed chunk_size, up to 128MB). Non-final chunks must be >= 5MB,
// which 64MB sizing guarantees.
export function planVideoChunks(size: number): { chunkSize: number; chunks: { start: number; end: number }[] } {
  if (size <= MAX_CHUNK) {
    return { chunkSize: size, chunks: [{ start: 0, end: size - 1 }] }
  }
  const count = Math.floor(size / MAX_CHUNK)
  const chunks: { start: number; end: number }[] = []
  for (let i = 0; i < count; i++) {
    const start = i * MAX_CHUNK
    const end = i === count - 1 ? size - 1 : start + MAX_CHUNK - 1
    chunks.push({ start, end })
  }
  return { chunkSize: MAX_CHUNK, chunks }
}

export async function postVideo({
  accessToken,
  video,
  mimeType = 'video/mp4',
}: {
  accessToken: string
  video: Uint8Array
  mimeType?: string
  description?: string
}) {
  const size = video.byteLength
  const { chunkSize, chunks } = planVideoChunks(size)

  // 1. Initialize the upload — TikTok returns an upload_url + publish_id.
  const initRes = await fetch(TIKTOK_INBOX_VIDEO_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: size,
        chunk_size: chunkSize,
        total_chunk_count: chunks.length,
      },
    }),
  })

  const initText = await initRes.text()
  console.log('[TikTok inbox FILE_UPLOAD init] status:', initRes.status, 'body:', initText)

  let initData: Record<string, unknown>
  try {
    initData = JSON.parse(initText)
  } catch {
    throw new Error(`TikTok returned non-JSON (${initRes.status}): ${initText.slice(0, 200)}`)
  }

  if (!initRes.ok || (initData.error as Record<string, unknown>)?.code !== 'ok') {
    throw new Error(`TikTok init error: ${JSON.stringify(initData.error ?? initData)}`)
  }

  const data = initData.data as { publish_id: string; upload_url: string }
  if (!data?.upload_url) {
    throw new Error(`TikTok init returned no upload_url: ${initText.slice(0, 200)}`)
  }

  // 2. PUT each chunk to the upload_url. Intermediate chunks return 206, the final 201.
  for (let i = 0; i < chunks.length; i++) {
    const { start, end } = chunks[i]
    // Copy the chunk into a fresh ArrayBuffer. A subarray/slice is typed as the generic
    // Uint8Array<ArrayBufferLike>, which fetch's BodyInit rejects; a plain ArrayBuffer is
    // an unambiguous, type-safe body. fetch sets Content-Length from it automatically —
    // the Content-Range header is what TikTok actually keys on for chunk ordering.
    const len = end - start + 1
    const body = new ArrayBuffer(len)
    new Uint8Array(body).set(video.subarray(start, end + 1))
    const putRes = await fetch(data.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
        'Content-Range': `bytes ${start}-${end}/${size}`,
      },
      body,
    })

    if (putRes.status !== 206 && putRes.status !== 201 && putRes.status !== 200) {
      const errText = await putRes.text()
      console.log(`[TikTok inbox FILE_UPLOAD chunk ${i + 1}/${chunks.length}] FAILED status:`, putRes.status, 'body:', errText.slice(0, 300))
      throw new Error(`TikTok upload chunk ${i + 1}/${chunks.length} failed (${putRes.status}): ${errText.slice(0, 200)}`)
    }
    console.log(`[TikTok inbox FILE_UPLOAD chunk ${i + 1}/${chunks.length}] status:`, putRes.status)
  }

  return { publish_id: data.publish_id }
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
