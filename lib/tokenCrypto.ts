/**
 * AES-256-GCM encrypt/decrypt for TikTok access tokens.
 * The key is a 64-char hex string (32 bytes) stored in TIKTOK_TOKEN_ENCRYPTION_KEY.
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Wire format: base64( iv[12] || authTag[16] || ciphertext )
 */

import crypto from 'crypto'

function getKey(): Buffer {
  const hex = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('TIKTOK_TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

export function encryptToken(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptToken(ciphertext: string): string {
  const key = getKey()
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const encrypted = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8')
}
