import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'crypto'
import { verifyResendWebhook, verifyStaticToken } from '@/lib/security/webhook'

// Base64 of "testsecret" — matches the Buffer.from(rawSecret, 'base64') decode
// the verifier performs.
const SECRET_B64 = Buffer.from('testsecret').toString('base64')

/** Forge a valid Svix-scheme signature header for the given parts. */
function signResend(id: string, ts: number, body: string): string {
  const secretBytes = Buffer.from(SECRET_B64, 'base64')
  const computed = createHmac('sha256', secretBytes)
    .update(`${id}.${ts}.${body}`)
    .digest('base64')
  return `v1,${computed}`
}

describe('verifyResendWebhook', () => {
  const ORIGINAL = process.env.RESEND_WEBHOOK_SECRET

  beforeEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = `whsec_${SECRET_B64}`
  })
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.RESEND_WEBHOOK_SECRET
    else process.env.RESEND_WEBHOOK_SECRET = ORIGINAL
  })

  it('accepts a correctly signed, fresh payload', () => {
    const id = 'msg_123'
    const ts = Math.floor(Date.now() / 1000)
    const body = '{"type":"email.delivered"}'
    const res = verifyResendWebhook(body, {
      'svix-id': id,
      'svix-timestamp': String(ts),
      'svix-signature': signResend(id, ts, body),
    })
    expect(res.ok).toBe(true)
  })

  it('rejects a tampered body (signature mismatch)', () => {
    const id = 'msg_123'
    const ts = Math.floor(Date.now() / 1000)
    const sig = signResend(id, ts, '{"type":"email.delivered"}')
    const res = verifyResendWebhook('{"type":"email.bounced"}', {
      'svix-id': id,
      'svix-timestamp': String(ts),
      'svix-signature': sig,
    })
    expect(res).toEqual({ ok: false, reason: 'signature_mismatch' })
  })

  it('rejects a replayed (too-old) timestamp', () => {
    const id = 'msg_123'
    const ts = Math.floor(Date.now() / 1000) - 10_000 // way past the 300s window
    const body = '{"type":"email.delivered"}'
    const res = verifyResendWebhook(body, {
      'svix-id': id,
      'svix-timestamp': String(ts),
      'svix-signature': signResend(id, ts, body),
    })
    expect(res).toEqual({ ok: false, reason: 'timestamp_too_old' })
  })

  it('rejects when svix headers are missing', () => {
    const res = verifyResendWebhook('{}', {})
    expect(res).toEqual({ ok: false, reason: 'missing_svix_headers' })
  })

  it('fails CLOSED when the signing secret is not configured', () => {
    delete process.env.RESEND_WEBHOOK_SECRET
    const res = verifyResendWebhook('{}', {
      'svix-id': 'x',
      'svix-timestamp': String(Math.floor(Date.now() / 1000)),
      'svix-signature': 'v1,whatever',
    })
    expect(res).toEqual({ ok: false, reason: 'secret_not_configured' })
  })
})

describe('verifyStaticToken', () => {
  const VAR = 'TEST_ASAAS_TOKEN'
  const ORIGINAL = process.env[VAR]

  beforeEach(() => {
    process.env[VAR] = 'super-secret-token'
  })
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env[VAR]
    else process.env[VAR] = ORIGINAL
  })

  it('accepts the exact matching token', () => {
    expect(verifyStaticToken('super-secret-token', VAR)).toEqual({ ok: true })
  })

  it('rejects a wrong token', () => {
    expect(verifyStaticToken('nope', VAR)).toEqual({ ok: false, reason: 'token_mismatch' })
  })

  it('rejects a missing incoming token', () => {
    expect(verifyStaticToken(null, VAR)).toEqual({ ok: false, reason: 'token_missing' })
    expect(verifyStaticToken(undefined, VAR)).toEqual({ ok: false, reason: 'token_missing' })
  })

  it('fails CLOSED when the env secret is not set', () => {
    delete process.env[VAR]
    expect(verifyStaticToken('anything', VAR)).toEqual({
      ok: false,
      reason: 'secret_not_configured',
    })
  })
})
