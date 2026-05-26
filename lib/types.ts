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

export type BulkPostResult = {
  draftId: string
  success: boolean
  publish_id?: string
  error?: string
}
