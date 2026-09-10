import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentContext } from '@/lib/agent/context'
import type { ToolDef } from '@/lib/agent/execute'

const mocks = vi.hoisted(() => ({ canAccess: vi.fn(), audit: vi.fn(), pending: vi.fn() }))
vi.mock('@/lib/agent/context', () => ({ agentCanAccess: mocks.canAccess }))
vi.mock('@/lib/agent/audit', () => ({ logAgentToolCall: mocks.audit }))
vi.mock('@/lib/agent/approval-store', () => ({ createApprovalRequest: mocks.pending }))
import { executeTool } from '@/lib/agent/execute'

const ctx: AgentContext = { tokenId: 'token', orgId: 'org', orgSlug: 'org', userId: 'user', role: 'admin', permissions: {}, agentLabel: 'codex' }
let tool: ToolDef<{ id: string }>
beforeEach(() => {
  vi.clearAllMocks()
  mocks.canAccess.mockReturnValue(true)
  mocks.pending.mockResolvedValue({ status: 'awaiting_approval' })
  tool = { name: 'update_contact', description: '', permissionKey: 'clients', riskLevel: 'HIGH', requiresApproval: true,
    prepare: vi.fn().mockResolvedValue({ id: '1', name: 'Before' }), handler: vi.fn().mockResolvedValue({ id: '1' }) }
})
describe('MCP execution approval boundary', () => {
  it('stores a pending request without invoking the mutation', async () => {
    expect(await executeTool(tool, ctx, { id: '1' })).toEqual({ ok: true, data: { status: 'awaiting_approval' } })
    expect(tool.handler).not.toHaveBeenCalled()
    expect(mocks.pending).toHaveBeenCalledOnce()
  })
  it('denies missing module permission before disclosing a preview', async () => {
    mocks.canAccess.mockReturnValue(false)
    expect((await executeTool(tool, ctx, { id: '1' })).ok).toBe(false)
    expect(tool.prepare).not.toHaveBeenCalled()
    expect(tool.handler).not.toHaveBeenCalled()
  })
  it('does not execute when the user rejects', async () => {
    expect((await executeTool(tool, ctx, { id: '1' }, async () => false, async () => ctx)).ok).toBe(false)
    expect(tool.handler).not.toHaveBeenCalled()
  })
  it('does not execute after token revocation', async () => {
    expect((await executeTool(tool, ctx, { id: '1' }, async () => true, async () => null)).ok).toBe(false)
    expect(tool.handler).not.toHaveBeenCalled()
  })
  it.each([{ ...ctx, orgId: 'another' }, { ...ctx, userId: 'another' }])('denies changed identity after approval', async fresh => {
    expect((await executeTool(tool, ctx, { id: '1' }, async () => true, async () => fresh)).ok).toBe(false)
    expect(tool.handler).not.toHaveBeenCalled()
  })
  it('refuses stale records and requires a new review', async () => {
    vi.mocked(tool.prepare!).mockResolvedValueOnce({ name: 'Before' }).mockResolvedValueOnce({ name: 'Changed' })
    expect((await executeTool(tool, ctx, { id: '1' }, async () => true, async () => ctx)).ok).toBe(false)
    expect(tool.handler).not.toHaveBeenCalled()
  })
  it('does not treat JSON object key order as a data change', async () => {
    vi.mocked(tool.prepare!).mockResolvedValueOnce({ a: 1, b: 2 }).mockResolvedValueOnce({ b: 2, a: 1 })
    expect((await executeTool(tool, ctx, { id: '1' }, async () => true, async () => ctx)).ok).toBe(true)
    expect(tool.handler).toHaveBeenCalledOnce()
  })
  it('surfaces storage failure without executing', async () => {
    mocks.pending.mockRejectedValue(new Error('Unavailable'))
    expect((await executeTool(tool, ctx, { id: '1' })).ok).toBe(false)
    expect(tool.handler).not.toHaveBeenCalled()
  })
  it('allows ordinary creation without an approval request', async () => {
    tool.requiresApproval = false
    expect((await executeTool(tool, ctx, { id: '1' })).ok).toBe(true)
    expect(tool.handler).toHaveBeenCalledOnce()
    expect(mocks.pending).not.toHaveBeenCalled()
  })
})
