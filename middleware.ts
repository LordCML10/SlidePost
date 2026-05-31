import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Routes that do NOT require a Clerk session:
//  - sign-in / sign-up (obviously public)
//  - TikTok OAuth callback — TikTok redirects here; Clerk session cookie is
//    still present so auth() works inside the handler, but we don't want
//    middleware to gate it in case of timing edge cases
//  - /api/image — image proxy that TikTok's servers pull from directly
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/auth/tiktok/callback(.*)',
  '/api/image(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
    '/',
    // Required for Clerk's proxy to work
    '/__clerk/(.*)',
  ],
}
