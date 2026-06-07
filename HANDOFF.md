# SlidePost — Session Handoff

**Project root:** `C:\Users\carlo\Projects\SlidePost\slidepost`  
**Deployed:** `https://slide-post.vercel.app`  
**Stack:** Next.js 14 App Router, Supabase (DB + Storage), Clerk v7 auth, TikTok Content Posting API v2

---

## 🔴 Current blockers

### 1. Vercel build is failing
Last commit pushed:
```
87faa2c Switch image proxy to Edge Runtime to remove 4.5MB response size limit
```
Only change in that commit: added `export const runtime = 'edge'` to `app/api/image/route.ts`.
Check Vercel dashboard build logs for the actual error.

### 2. TikTok posts failing with `picture_size_check_failed`
Drafts are being submitted to TikTok successfully (a `publish_id` comes back), but when the status is checked via `GET /api/posts/status`, both recent posts show:
```
status: "FAILED"
fail_reason: "picture_size_check_failed"
```
The user confirmed the images are not too small (well above 360×360px minimum). The images have been successfully posted before via a different flow in the same app.

The flow that fails is **bulk-post** (`POST /api/drafts/bulk-post`), which pulls image URLs from the `images` DB table and builds proxy URLs:
```typescript
`${appUrl}/api/image?src=${encodeURIComponent(img.public_url)}`
```
TikTok fetches those proxy URLs via `PULL_FROM_URL` mode.

The proxy (`app/api/image/route.ts`) fetches the image from Supabase Storage and streams it back. It forwards `Content-Type` and `Content-Length` (if present) from the upstream Supabase response.

---

## Key files relevant to the errors

| File | Purpose |
|------|---------|
| `app/api/image/route.ts` | Image proxy — streams Supabase images from verified domain for TikTok |
| `app/api/drafts/bulk-post/route.ts` | Posts selected drafts to TikTok |
| `app/api/posts/status/route.ts` | Checks TikTok publish status by publish_id |
| `lib/tiktok.ts` | TikTok API helpers: post, checkPublishStatus, refreshTikTokToken |
| `lib/tiktokAccounts.ts` | DB layer for tiktok_accounts: getDecryptedToken (includes auto-refresh logic) |

---

## Critical patterns (do not break)

- `supabaseAdmin` uses custom `fetch` with `cache: 'no-store'` — never remove this
- Use `.maybeSingle()` not `.single()` (`.single()` throws on 0 rows)
- `proxy_url` is never stored in DB — computed at API query time
- All API routes need `export const dynamic = 'force-dynamic'`
- TikTok `post_mode: 'MEDIA_UPLOAD'` sends to creator inbox as draft (NOT `DIRECT_POST`)
- Clerk: use `auth()` from `@clerk/nextjs/server` in routes, `useAuth().getToken()` for client Bearer tokens
- Next.js 16: dynamic route params are `Promise<{id}>` — must be `await`ed
