import { describe, it, expect } from 'vitest'
import { buildObjectKey } from '@/lib/storage/types'

describe('buildObjectKey', () => {
  it('builds tenants/{org}/{category}/{fileId} without scopeId', () => {
    expect(
      buildObjectKey({ organizationId: 'org1', category: 'avatars', fileId: 'file1' }),
    ).toBe('tenants/org1/avatars/file1')
  })

  it('includes scopeId as an extra segment when present', () => {
    expect(
      buildObjectKey({ organizationId: 'org1', category: 'whatsapp', scopeId: 'conv456', fileId: 'msg789' }),
    ).toBe('tenants/org1/whatsapp/conv456/msg789')
  })

  it('omits the scopeId segment when null or undefined', () => {
    expect(
      buildObjectKey({ organizationId: 'org1', category: 'documents', scopeId: null, fileId: 'file1' }),
    ).toBe('tenants/org1/documents/file1')
    expect(
      buildObjectKey({ organizationId: 'org1', category: 'documents', fileId: 'file1' }),
    ).toBe('tenants/org1/documents/file1')
  })

  it('keeps tenants isolated — two different orgs never produce the same key for the same fileId', () => {
    const keyA = buildObjectKey({ organizationId: 'org-a', category: 'attachments', fileId: 'same-file-id' })
    const keyB = buildObjectKey({ organizationId: 'org-b', category: 'attachments', fileId: 'same-file-id' })
    expect(keyA).not.toBe(keyB)
    expect(keyA.startsWith('tenants/org-a/')).toBe(true)
    expect(keyB.startsWith('tenants/org-b/')).toBe(true)
  })
})
