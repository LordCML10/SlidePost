/**
 * Data-access layer for the tiktok_accounts table.
 * All token storage/retrieval goes through here.
 * Never returns the raw encrypted token to callers — only decrypts when needed.
 */

import { supabaseAdmin } from './supabase'
import { encryptToken, decryptToken } from './tokenCrypto'
import type { TikTokAccount } from './types'

// ── Save (upsert) a TikTok account for a Clerk user ──────────────────────────
export async function saveTikTokAccount(params: {
  userId: string
  openId: string
  accessToken: string
  displayName: string | null
  avatarUrl: string | null
  expiresIn: number
}): Promise<TikTokAccount> {
  const encrypted = encryptToken(params.accessToken)
  const expiresAt = new Date(Date.now() + params.expiresIn * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('tiktok_accounts')
    .upsert(
      {
        user_id: params.userId,
        open_id: params.openId,
        encrypted_access_token: encrypted,
        display_name: params.displayName,
        avatar_url: params.avatarUrl,
        expires_at: expiresAt,
      },
      { onConflict: 'user_id,open_id' }
    )
    .select('id, open_id, display_name, avatar_url, created_at')
    .maybeSingle()

  if (error || !data) throw new Error(error?.message ?? 'Failed to save TikTok account')
  return data as TikTokAccount
}

// ── List all TikTok accounts for a Clerk user ─────────────────────────────────
export async function listTikTokAccounts(userId: string): Promise<TikTokAccount[]> {
  const { data, error } = await supabaseAdmin
    .from('tiktok_accounts')
    .select('id, open_id, display_name, avatar_url, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as TikTokAccount[]
}

// ── Delete a TikTok account — IDOR check: userId must match ──────────────────
export async function deleteTikTokAccount(id: string, userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('tiktok_accounts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId) // ownership check

  if (error) throw new Error(error.message)
}

// ── Get decrypted access token — IDOR check: userId must match ───────────────
export async function getDecryptedToken(accountId: string, userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('tiktok_accounts')
    .select('encrypted_access_token, expires_at')
    .eq('id', accountId)
    .eq('user_id', userId) // ownership check
    .maybeSingle()

  if (error || !data) throw new Error('TikTok account not found — please reconnect it from the nav.')
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    throw new Error('TikTok access token expired — disconnect and reconnect your account from the nav.')
  }
  return decryptToken(data.encrypted_access_token)
}

// ── Verify an account belongs to a user (lightweight check) ─────────────────
export async function verifyAccountOwnership(accountId: string, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('tiktok_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle()

  return !!data
}
