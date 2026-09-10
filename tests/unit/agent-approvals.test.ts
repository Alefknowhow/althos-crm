import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ db: vi.fn(), user: vi.fn(), org: vi.fn(), resolve: vi.fn(), execute: vi.fn(), prepare: vi.fn(), impersonating: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: m.db }))
vi.mock('@/lib/supabase/types', () => ({ requireAuth: m.user, getCurrentOrganization: m.org, isImpersonating: m.impersonating }))
vi.mock('@/lib/agent/context', () => ({ resolveAgentTokenId: m.resolve, agentCanAccess: () => true }))
vi.mock('@/lib/agent/tools/registry', () => ({ TOOL_REGISTRY: [{ tool: { name: 'update_contact', requiresApproval: true, permissionKey: 'clients', prepare: m.prepare } }] }))
vi.mock('@/lib/agent/execute', () => ({ executeTool: m.execute }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { reviewAgentOperation } from '@/actions/agent-approvals'
const operationId = '11111111-1111-4111-8111-111111111111'
let chain: Record<string, any>
let request: Record<string, any> | null
const form = () => { const f = new FormData(); f.set('decision', 'approve'); f.set('understood', 'yes'); return f }
beforeEach(() => {
  vi.clearAllMocks()
  m.user.mockResolvedValue({ id: 'user' }); m.org.mockResolvedValue({ id: 'org' }); m.impersonating.mockReturnValue(false)
  m.resolve.mockResolvedValue({ userId: 'user', orgId: 'org' }); m.prepare.mockResolvedValue({ value: 1 }); m.execute.mockResolvedValue({ ok: true, data: {} })
  request = { token_id: 'token', tool: 'update_contact', input: { id: 'record' }, preview: { value: 1 } }
  chain = { update: vi.fn(), eq: vi.fn(), gt: vi.fn(), select: vi.fn(), maybeSingle: vi.fn(async () => ({ data: request, error: null })) }
  for (const method of ['update', 'eq', 'gt', 'select']) chain[method].mockReturnValue(chain)
  m.db.mockReturnValue({ from: vi.fn(() => chain) })
})
describe('authenticated approval consumption', () => {
  it('requires the explicit checkbox before consuming', async () => {
    const f = form(); f.delete('understood')
    await expect(reviewAgentOperation('org', operationId, f)).rejects.toThrow('Confirme')
    expect(m.db).not.toHaveBeenCalled()
  })
  it('rejects impersonation', async () => {
    m.impersonating.mockReturnValue(true)
    await expect(reviewAgentOperation('org', operationId, form())).rejects.toThrow('impersonação')
    expect(m.execute).not.toHaveBeenCalled()
  })
  it('requires atomic pending/unexpired/owner match and refuses consumed requests', async () => {
    request = null
    await expect(reviewAgentOperation('org', operationId, form())).rejects.toThrow('expirada')
    expect(chain.eq).toHaveBeenCalledWith('organization_id', 'org')
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user')
    expect(chain.eq).toHaveBeenCalledWith('status', 'pending')
    expect(chain.gt).toHaveBeenCalledWith('expires_at', expect.any(String))
    expect(m.execute).not.toHaveBeenCalled()
  })
  it('does not execute an operation belonging to another token identity', async () => {
    m.resolve.mockResolvedValue({ userId: 'different', orgId: 'org' })
    await reviewAgentOperation('org', operationId, form())
    expect(m.execute).not.toHaveBeenCalled()
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }))
  })
  it('requires fresh consent when data differs from the saved preview', async () => {
    m.prepare.mockResolvedValue({ value: 2 })
    await reviewAgentOperation('org', operationId, form())
    expect(m.execute).not.toHaveBeenCalled()
  })
  it('executes once after validating user, token and preview', async () => {
    await reviewAgentOperation('org', operationId, form())
    expect(m.execute).toHaveBeenCalledOnce()
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'executing' }))
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'succeeded' }))
  })
  it('rejects without executing or resolving the token', async () => {
    const f = form(); f.set('decision', 'reject')
    await reviewAgentOperation('org', operationId, f)
    expect(m.execute).not.toHaveBeenCalled(); expect(m.resolve).not.toHaveBeenCalled()
  })
})
