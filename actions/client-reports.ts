'use server'

/**
 * Relatórios em PDF do cliente de tráfego — reaproveita a infraestrutura
 * genérica de storage (uploadFile/getObjectSignedUrl, actions/storage-upload.ts
 * e actions/storage-read.ts, categoria 'documents') em vez de criar um
 * bucket/tabela própria. O relatório fica marcado em storage_objects.metadata
 * como {kind: 'client_report', contato_id, period_start, period_end}, o que
 * também prepara terreno pro Portal do Cliente (Fase 3) liberar o mesmo
 * arquivo sem duplicar armazenamento.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { uploadFile } from '@/actions/storage-upload'

export type ClientReport = {
  id: string
  filename: string | null
  size_bytes: number | null
  created_at: string
  period_start: string | null
  period_end: string | null
}

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

export async function listClientReports(orgSlug: string, contatoId: string): Promise<ClientReport[]> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('storage_objects')
    .select('id, filename, size_bytes, created_at, metadata')
    .eq('organization_id', org.id)
    .eq('status', 'active')
    .eq('metadata->>kind', 'client_report')
    .eq('metadata->>contato_id', contatoId)
    .order('created_at', { ascending: false })

  return ((data || []) as any[]).map(r => ({
    id: r.id,
    filename: r.filename,
    size_bytes: r.size_bytes,
    created_at: r.created_at,
    period_start: r.metadata?.period_start ?? null,
    period_end: r.metadata?.period_end ?? null,
  }))
}

export async function saveClientReportPdf(
  orgSlug: string,
  contatoId: string,
  base64Pdf: string,
  period: { start: string; end: string },
): Promise<{ ok: true; objectId: string } | { ok: false; error: string }> {
  await requireAccess(orgSlug)

  const res = await uploadFile(orgSlug, {
    category: 'documents',
    scopeId: contatoId,
    filename: `relatorio-${period.start}-a-${period.end}.pdf`,
    contentType: 'application/pdf',
    base64: base64Pdf,
    metadata: { kind: 'client_report', contato_id: contatoId, period_start: period.start, period_end: period.end },
  })
  if (!res.ok) return { ok: false, error: res.error }
  return { ok: true, objectId: res.objectId }
}
