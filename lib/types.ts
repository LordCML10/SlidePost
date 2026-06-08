export type Tag = {
  id: string
  name: string
  user_id: string | null
  created_at: string
}

export type ImageRecord = {
  id: string
  filename: string
  storage_path: string
  public_url: string
  tag_id: string | null
  user_id: string | null
  created_at: string
}

// proxy_url is computed by API layer, never stored in DB
export type ImageWithProxy = ImageRecord & { proxy_url: string }

export type HashtagSet = {
  id: string
  name: string
  hashtags: string[]
  user_id: string | null
  created_at: string
}

export type Draft = {
  id: string
  name: string | null
  image_ids: string[]
  caption: string
  hashtag_set_id: string | null
  custom_hashtags: string[] | null
  posted: boolean
  posted_at: string | null
  publish_id: string | null
  user_id: string | null
  created_at: string
}

export type Caption = {
  id: string
  name: string
  text: string
  user_id: string | null
  created_at: string
}

export type BulkPostResult = {
  draftId: string
  success: boolean
  publish_id?: string
  error?: string
}

// A finished clip uploaded by the local ClipR pipeline, ready to post.
// public_url is computed by the API layer (signed/public Supabase Storage URL), never stored in DB.
export type Clip = {
  id: string
  storage_path: string
  filename: string
  status: 'ready' | 'posted' | 'failed'
  caption: string | null
  posted: boolean
  posted_at: string | null
  publish_id: string | null
  user_id: string | null
  created_at: string
}

export type ClipWithProxy = Clip & { proxy_url: string }

export type ClipPostResult = {
  clipId: string
  success: boolean
  publish_id?: string
  error?: string
}

// TikTok account connected to a Clerk user (never exposes the encrypted token)
export type TikTokAccount = {
  id: string
  open_id: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
}
