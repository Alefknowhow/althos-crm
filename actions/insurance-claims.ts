'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { inngest } from '@/lib/inngest/client'
import { revalidatePath } from 'next/cache'

/**
 * Sinistros (Vertical Seguros, Fase 5) — ver
 * supabase/migrations/0189_insurance_claims.sql. Acompanhamento pra
 * corretora, não substitui o sistema da seguradora (prompt original).
 * Seguradora vem via join com insurance_policies — sem FK redundante.
 */

export type InsuranceClaimStatus =
  | 'aberto' | 'em_analise' | 'aguardando_documentos' | 'em_regulacao'
  | 'aprovado' | 'negado' | 'concluido'

export type InsuranceClaimDocument = { id: string; storageKey: string; label: string | null; kind: string | null; createdAt: string }

export type InsuranceClaimRow = {
  id: string
  policy_id: string
  contato_id: string
  claim_type: string | null
  occurred_at: string | null
  protocol_number: string | null
  description: string | null
  responsavel_user_id: string | null
  status: InsuranceClaimStatus
  notes: string | null
  created_at: string
  contato_name: string | null
  policy_number: string | null
  insurer_name: string | null
  documents: InsuranceClaimDocument[]
}

const ClaimSchema = z.object({
  policyId: z.string().uuid(),
  contatoId: z.string().uuid(),
  claimType: z.string().max(120).nullable().optional(),
  occurredAt: z.string().nullable().optional(),
  protocolNumber: z.string().max(120).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  responsavelUserId: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'seguros')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

const SELECT = '*, contatos(name), insurance_policies(policy_number, insurers(name)), insurance_claim_documents(id, storage_key, label, kind, created_at)'

function mapRow(r: any): InsuranceClaimRow {
  return {
    id: r.id, policy_id: r.policy_id, contato_id: r.contato_id, claim_type: r.claim_type,
    occurred_at: r.occurred_at, protocol_number: r.protocol_number, description: r.description,
    responsavel_user_id: r.responsavel_user_id, status: r.status, notes: r.notes, created_at: r.created_at,
    contato_name: r.contatos?.name ?? null, policy_number: r.insurance_policies?.policy_number ?? null,
    insurer_name: r.insurance_policies?.insurers?.name ?? null,
    documents: (r.insurance_claim_documents || []).map((d: any) => ({
      id: d.id, storageKey: d.storage_key, label: d.label, kind: d.kind, createdAt: d.created_at,
    })),
  }
}

export async function listClaims(orgSlug: string): Promise<InsuranceClaimRow[]> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('insurance_claims').select(SELECT)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(500)
  return (data || []).map(mapRow)
}

export async function getClaim(orgSlug: string, id: string): Promise<InsuranceClaimRow | null> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('insurance_claims').select(SELECT)
    .eq('id', id).eq('organization_id', org.id)
    .maybeSingle()
  return data ? mapRow(data) : null
}

export async function createClaim(orgSlug: string, input: unknown) {
  const { org, user } = await requireAccess(orgSlug)
  const parsed = ClaimSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }
  const v = parsed.data

  const supabase = createClient()
  const { data: claim, error } = await supabase
    .from('insurance_claims')
    .insert({
      organization_id: org.id, policy_id: v.policyId, contato_id: v.contatoId,
      claim_type: v.claimType ?? null, occurred_at: v.occurredAt || null,
      protocol_number: v.protocolNumber ?? null, description: v.description ?? null,
      responsavel_user_id: v.responsavelUserId ?? null, notes: v.notes ?? null, created_by: user.id,
    })
    .select('id')
    .single()
  if (error || !claim) return { ok: false as const, error: error?.message || 'Erro ao abrir sinistro' }

  const [{ data: contato }, { data: policy }, { data: column }] = await Promise.all([
    supabase.from('contatos').select('name').eq('id', v.contatoId).maybeSingle(),
    supabase.from('insurance_policies').select('policy_number').eq('id', v.policyId).maybeSingle(),
    supabase.from('task_columns').select('id').eq('organization_id', org.id).order('position', { ascending: true }).limit(1).maybeSingle(),
  ])
  await supabase.from('tasks').insert({
    organization_id: org.id, contato_id: v.contatoId,
    title: `Sinistro aberto: ${contato?.name || 'cliente'} — apólice ${policy?.policy_number || ''}`,
    due_date: new Date().toISOString().slice(0, 10), priority: 'normal', status: 'open',
    assigned_to: v.responsavelUserId || user.id, column_id: column?.id ?? null,
  })

  await inngest.send({
    name: 'seguros.claim.opened',
    data: { orgId: org.id, leadId: v.contatoId, claimId: claim.id, policyId: v.policyId },
  })

  revalidatePath(`/app/${orgSlug}/sinistros`)
  return { ok: true as const, id: claim.id as string }
}

export async function updateClaim(orgSlug: string, id: string, input: unknown) {
  const { org } = await requireAccess(orgSlug)
  const parsed = ClaimSchema.partial().safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }
  const v = parsed.data

  const patch: Record<string, unknown> = {}
  if (v.claimType !== undefined) patch.claim_type = v.claimType
  if (v.occurredAt !== undefined) patch.occurred_at = v.occurredAt || null
  if (v.protocolNumber !== undefined) patch.protocol_number = v.protocolNumber
  if (v.description !== undefined) patch.description = v.description
  if (v.responsavelUserId !== undefined) patch.responsavel_user_id = v.responsavelUserId
  if (v.notes !== undefined) patch.notes = v.notes

  const supabase = createClient()
  const { error } = await supabase.from('insurance_claims').update(patch).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/sinistros`)
  return { ok: true as const }
}

export async function setClaimStatus(orgSlug: string, id: string, status: InsuranceClaimStatus) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('insurance_claims').update({ status }).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/sinistros`)
  return { ok: true as const }
}

export async function addClaimDocument(orgSlug: string, claimId: string, input: { storageKey: string; label?: string | null; kind?: string | null }) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('insurance_claim_documents').insert({
    organization_id: org.id, claim_id: claimId, storage_key: input.storageKey,
    label: input.label ?? null, kind: input.kind ?? null,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/sinistros`)
  return { ok: true as const }
}

export async function removeClaimDocument(orgSlug: string, id: string) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('insurance_claim_documents').delete().eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/sinistros`)
  return { ok: true as const }
}
