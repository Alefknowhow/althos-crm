/**
 * Criptografia dos dumps de banco antes de subir pro bucket de backup —
 * AES-256-GCM (autenticado, detecta corrupção/adulteração na
 * descriptografia). Chave vem de BACKUP_ENCRYPTION_KEY (32 bytes,
 * base64), gerada uma vez e nunca commitada — se for perdida, todo
 * backup criptografado com ela fica irrecuperável (ver
 * docs/backup-disaster-recovery.md).
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // recomendado pro GCM

function getKey(): Buffer {
  const raw = process.env.BACKUP_ENCRYPTION_KEY
  if (!raw) throw new Error('BACKUP_ENCRYPTION_KEY não configurado.')
  const key = Buffer.from(raw, 'base64')
  if (key.byteLength !== 32) throw new Error('BACKUP_ENCRYPTION_KEY inválido — precisa ser 32 bytes em base64 (AES-256).')
  return key
}

/** Formato do buffer criptografado: [iv (12B)][authTag (16B)][ciphertext]. */
export function encryptBuffer(plain: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext])
}

export function decryptBuffer(encrypted: Buffer): Buffer {
  const iv = encrypted.subarray(0, IV_LENGTH)
  const authTag = encrypted.subarray(IV_LENGTH, IV_LENGTH + 16)
  const ciphertext = encrypted.subarray(IV_LENGTH + 16)
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

export function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}
