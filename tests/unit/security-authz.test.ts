import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Regression guards for the multi-tenant/authorization fixes found in the
 * security audit (see security-audit-report.md). These read the actual
 * source files rather than execute the server actions — the project has no
 * Supabase-mocking harness for 'use server' actions today (every existing
 * unit test targets pure lib functions), so this is the proportionate way to
 * pin the fix without inventing new test infrastructure.
 */

function read(relPath: string): string {
  return readFileSync(join(process.cwd(), relPath), 'utf8')
}

describe('markNotificationRead — cross-tenant IDOR fix', () => {
  it('scopes the update by organization_id (not just the row id)', () => {
    const src = read('actions/notifications.ts')
    const fnStart = src.indexOf('export async function markNotificationRead')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = src.slice(fnStart, src.indexOf('\n}', fnStart))
    expect(fnBody).toContain(".eq('organization_id', org.id)")
  })
})

describe("whatsapp-templates — org filter on update after admin-client fetch", () => {
  it('submitWaTemplateToMeta scopes its update by organization_id', () => {
    const src = read('actions/whatsapp-templates.ts')
    const fnStart = src.indexOf('export async function submitWaTemplateToMeta')
    const fnEnd = src.indexOf('\nexport async function refreshWaTemplateStatus')
    const fnBody = src.slice(fnStart, fnEnd)
    // Two org-scoped calls expected: the validating fetch AND the update.
    const matches = fnBody.match(/\.eq\('organization_id', orgId\)/g) || []
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })

  it('refreshWaTemplateStatus scopes its update by organization_id', () => {
    const src = read('actions/whatsapp-templates.ts')
    const fnStart = src.indexOf('export async function refreshWaTemplateStatus')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = src.slice(fnStart)
    const matches = fnBody.match(/\.eq\('organization_id', orgId\)/g) || []
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })
})

describe('push senders — not reachable as server actions', () => {
  it("actions/push.ts (a 'use server' file) no longer exports sendPushToUser/sendPushToOrg", () => {
    const src = read('actions/push.ts')
    expect(src).not.toMatch(/export\s+(async\s+function\s+)?sendPushToUser/)
    expect(src).not.toMatch(/export\s+(async\s+function\s+)?sendPushToOrg/)
  })

  it('lib/push/send.ts (where they now live) is a plain module, not a server action file', () => {
    const src = read('lib/push/send.ts')
    expect(src.trimStart().startsWith("'use server'")).toBe(false)
    expect(src).toContain('export async function sendPushToUser')
    expect(src).toContain('export async function sendPushToOrg')
  })
})

describe('invite/recovery-code redemption — rate limited', () => {
  it('validateInvite and redeemInvite call the shared rate limiter', () => {
    const src = read('actions/invites.ts')
    expect(src).toContain("checkAndRecordRateLimit('invite-validate')")
    expect(src).toContain("checkAndRecordRateLimit('invite-redeem')")
  })

  it('redeemRecoveryCode calls the shared rate limiter with a tight window', () => {
    const src = read('actions/mfa.ts')
    expect(src).toContain("checkAndRecordRateLimit('mfa-recovery-redeem'")
  })
})

describe('robots.txt — no redundant Allow, no backslashes, exact-match anchors present', () => {
  it('app/robots.ts disallows single-segment routes without an Allow rule', () => {
    const src = read('app/robots.ts')
    // Strip "disallow:" occurrences first so we can check for a standalone
    // "allow:" key (the redundant `Allow: /` rule) without false-matching.
    expect(src.replace(/disallow/gi, '')).not.toMatch(/allow\s*:/i)
    expect(src).not.toContain('\\/')
    // Routes with no subroutes get an exact-match anchor so they don't
    // accidentally block a future public page with a similar name.
    expect(src).toContain("'/onboarding$'")
    expect(src).toContain("'/mfa$'")
  })
})
