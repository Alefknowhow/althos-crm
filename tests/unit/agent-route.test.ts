import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ resolve: vi.fn(), execute: vi.fn() }))
vi.mock('react', async importOriginal => ({ ...await importOriginal<typeof import('react')>(), cache: (fn: unknown) => fn }))
vi.mock('@/lib/agent/context', () => ({ resolveAgentContext: m.resolve, agentCanAccess: () => true }))
vi.mock('@/lib/agent/execute', () => ({ executeTool: m.execute }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createAdminClient: vi.fn() }))
import { POST } from '@/app/api/mcp/route'

beforeEach(() => {
  m.resolve.mockResolvedValue({ orgId: 'org', userId: 'user', tokenId: 'token' })
  m.execute.mockResolvedValue({ ok: true, data: { status: 'awaiting_approval' } })
})
async function call(method: string, params?: unknown, authenticated = true) {
  const response = await POST(new Request('https://crm.test/api/mcp', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(authenticated ? { Authorization: 'Bearer test-token' } : {}) },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }))
  const raw = await response.text()
  const data = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(raw.split('\n').find(line => line.startsWith('data:'))!.slice(5))
  return { response, data }
}
describe('actual MCP transport and schema registration', () => {
  it('rejects missing and revoked bearer tokens', async () => {
    expect((await call('tools/list', {}, false)).response.status).toBe(401)
    m.resolve.mockResolvedValue(null)
    expect((await call('tools/list', {})).response.status).toBe(401)
  })
  it('advertises all 34 tools with unique names and mutation annotations', async () => {
    const { data } = await call('tools/list', {})
    expect(data.result.tools).toHaveLength(34)
    const names = data.result.tools.map((tool: any) => tool.name)
    expect(new Set(names).size).toBe(34)
    expect(names).toEqual(expect.arrayContaining(['get_dashboard_data', 'create_contact', 'update_reservation', 'delete_financial_entry', 'get_operation_status']))
    expect(data.result.tools.find((tool: any) => tool.name === 'update_contact').annotations.destructiveHint).toBe(true)
  })
  it('returns pending authorization as a successful tool response, not an executed write', async () => {
    const { data } = await call('tools/call', { name: 'update_contact', arguments: { id: '11111111-1111-4111-8111-111111111111', patch: { name: 'Updated' } } })
    expect(JSON.parse(data.result.content[0].text).status).toBe('awaiting_approval')
  })
})
