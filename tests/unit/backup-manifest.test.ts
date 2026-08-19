import { describe, it, expect } from 'vitest'
import { buildManifestKey, serializeManifest, type BackupManifest } from '@/lib/backup/manifest'

describe('buildManifestKey', () => {
  it('builds a date-stamped key per type and tier', () => {
    const date = new Date('2026-08-19T12:34:56Z')
    expect(buildManifestKey('database', 'daily', date)).toBe('manifests/daily/database-2026-08-19.json')
    expect(buildManifestKey('storage', 'weekly', date)).toBe('manifests/weekly/storage-2026-08-19.json')
  })
})

describe('serializeManifest', () => {
  it('round-trips through JSON without loss', () => {
    const manifest: BackupManifest = {
      backup_id: 'abc-123',
      timestamp: '2026-08-19T03:00:00.000Z',
      type: 'database',
      tenant_count: 0,
      object_count: 90,
      database_size_bytes: 12345,
      storage_size_bytes: null,
      checksum: 'deadbeef',
      status: 'success',
      version: 1,
      duration_ms: 4200,
    }
    const parsed = JSON.parse(serializeManifest(manifest).toString('utf-8'))
    expect(parsed).toEqual(manifest)
  })
})
