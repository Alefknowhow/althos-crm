import { describe, it, expect, beforeAll } from 'vitest'
import { randomBytes } from 'crypto'

// Chave de teste, gerada localmente — nunca usada em produção. Setada
// antes do import porque crypto.ts lê BACKUP_ENCRYPTION_KEY sob demanda
// (dentro de getKey()), não no top-level do módulo.
beforeAll(() => {
  process.env.BACKUP_ENCRYPTION_KEY = randomBytes(32).toString('base64')
})

describe('encryptBuffer / decryptBuffer', () => {
  it('round-trips arbitrary data losslessly', async () => {
    const { encryptBuffer, decryptBuffer } = await import('@/lib/backup/crypto')
    const original = Buffer.from(JSON.stringify({ hello: 'world', n: 42, arr: [1, 2, 3] }), 'utf-8')
    const encrypted = encryptBuffer(original)
    const decrypted = decryptBuffer(encrypted)
    expect(decrypted.equals(original)).toBe(true)
  })

  it('produces different ciphertext for the same input each time (random IV)', async () => {
    const { encryptBuffer } = await import('@/lib/backup/crypto')
    const original = Buffer.from('same input', 'utf-8')
    const a = encryptBuffer(original)
    const b = encryptBuffer(original)
    expect(a.equals(b)).toBe(false)
  })

  it('detects tampering — corrupted ciphertext fails to decrypt (GCM auth tag)', async () => {
    const { encryptBuffer, decryptBuffer } = await import('@/lib/backup/crypto')
    const encrypted = encryptBuffer(Buffer.from('sensitive data', 'utf-8'))
    encrypted[encrypted.byteLength - 1] ^= 0xff // corrompe o último byte do ciphertext
    expect(() => decryptBuffer(encrypted)).toThrow()
  })
})

describe('sha256', () => {
  it('is deterministic', async () => {
    const { sha256 } = await import('@/lib/backup/crypto')
    const buf = Buffer.from('checksum me', 'utf-8')
    expect(sha256(buf)).toBe(sha256(buf))
  })

  it('differs for different input', async () => {
    const { sha256 } = await import('@/lib/backup/crypto')
    expect(sha256(Buffer.from('a'))).not.toBe(sha256(Buffer.from('b')))
  })
})
