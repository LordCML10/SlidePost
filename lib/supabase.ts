import { createClient } from '@supabase/supabase-js'

// Server-side only — service role key bypasses RLS
// Never import this in client components
// Custom fetch forces cache: 'no-store' so Next.js never caches Supabase responses
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    global: {
      fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }),
    },
  }
)
