/**
 * Manifest de um backup — o registro que responde "o que exatamente
 * está protegido neste backup?" (sem precisar abrir o dump em si).
 * Um manifest por run, gravado em manifests/{daily|weekly|monthly}/{data}.json
 * no bucket de backup.
 */

export type BackupManifest = {
  backup_id: string
  timestamp: string
  type: 'database' | 'storage'
  tenant_count: number
  object_count: number
  database_size_bytes: number | null
  storage_size_bytes: number | null
  checksum: string
  status: 'success' | 'invalid'
  version: number
  duration_ms: number
}

export function buildManifestKey(type: 'database' | 'storage', tier: 'daily' | 'weekly' | 'monthly', date: Date): string {
  const iso = date.toISOString().slice(0, 10)
  return `manifests/${tier}/${type}-${iso}.json`
}

export function serializeManifest(manifest: BackupManifest): Buffer {
  return Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8')
}
