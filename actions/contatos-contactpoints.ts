'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { CONTATO_STATUSES } from '@/lib/contatos'
import { canCreateLead } from '@/lib/billing/limits'
import { isAccessBlocked } from '@/lib/billing/plans'
import { checkContatoPermission, FROZEN_ERROR } from './contatos-shared'

/* =========================================================
 *  Contact points (email/phone), customer creation, contato panel
 * ========================================================= */

const primaryContactSchema = z.object({
  email: z.string().email('E-mail inválido').optional().or(z.literal('')).nullable(),
  phone: z.string().optional().nullable(),
  instagram_username: z.string().optional().nullable(),
})

/** Normaliza o @usuário do Instagram: remove "@", espaços e a URL, se colada
 *  (ex.: "https://instagram.com/fulano" ou "@fulano" -> "fulano"). */
function normalizeInstagramUsername(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const withoutUrl = trimmed.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
  const cleaned = withoutUrl.replace(/^@/, '').replace(/\/$/, '').trim()
  return cleaned || null
}

/** Atualiza o e-mail/telefone/Instagram principal (contatos.email/phone/
 *  instagram_username) — usados em busca, WhatsApp e dedup de leads do
 *  Instagram (ver lib/social/engine.ts::maybeCreateLead). */
export async function updateContatoPrimaryContact(orgSlug: string, contatoId: string, raw: unknown) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const parsed = primaryContactSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  const { error } = await supabase
    .from('contatos')
    .update({
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      instagram_username: normalizeInstagramUsername(parsed.data.instagram_username),
    })
    .eq('id', contatoId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const }
}

export type ContatoContactPoint = { id: string; kind: 'email' | 'phone'; label: string | null; value: string }

export async function listContatoContactPoints(orgSlug: string, contatoId: string): Promise<ContatoContactPoint[]> {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('contato_contact_points')
    .select('id, kind, label, value')
    .eq('contato_id', contatoId)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: true })
  return (data as ContatoContactPoint[]) || []
}

export async function addContatoContactPoint(
  orgSlug: string,
  contatoId: string,
  kind: 'email' | 'phone',
  label: string,
  value: string,
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  if (!value.trim()) return { ok: false as const, error: 'Preencha o valor.' }
  const supabase = createClient()

  const { data, error } = await supabase
    .from('contato_contact_points')
    .insert({ organization_id: org.id, contato_id: contatoId, kind, label: label.trim() || null, value: value.trim() })
    .select('id, kind, label, value')
    .single()

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const, point: data as ContatoContactPoint }
}

export async function removeContatoContactPoint(orgSlug: string, pointId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { error } = await supabase
    .from('contato_contact_points')
    .delete()
    .eq('id', pointId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const }
}

/* -------- Criar contato como cliente direto -------- */

const newCustomerSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
})

export async function createCustomer(orgSlug: string, raw: unknown) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const supabase = createClient()

  const parsed = newCustomerSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }
  const { name, email, phone } = parsed.data

  let pipeline_id: string | undefined
  let stage_id: string | undefined
  const { data: pipeline } = await supabase
    .from('pipelines').select('id').eq('organization_id', org.id).eq('is_default', true).maybeSingle()
  if (pipeline) {
    pipeline_id = pipeline.id
    const { data: stage } = await supabase
      .from('pipeline_stages').select('id').eq('pipeline_id', pipeline.id).order('position').limit(1).maybeSingle()
    stage_id = stage?.id
  }
  if (!stage_id) return { ok: false as const, error: 'Configure um pipeline com pelo menos um estágio antes de criar contatos.' }

  const { data: lead, error } = await supabase
    .from('contatos')
    .insert({
      organization_id: org.id,
      pipeline_id,
      stage_id,
      name,
      email: email || null,
      phone: phone || null,
      assigned_to: user.id,
      status: 'cliente',
      became_customer_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !lead) return { ok: false as const, error: error?.message || 'Erro ao criar contato' }

  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const, id: lead.id }
}

/* -------- Criar contato (sem exigir pipeline) -------- */

const newContatoSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório'),
  email: z.string().trim().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().trim().optional().or(z.literal('')),
  status: z.enum(CONTATO_STATUSES).default('lead'),
  source: z.string().trim().max(120).optional().or(z.literal('')),
})

/**
 * Cria um contato direto na tela de Contatos — não passa pelo funil, então
 * pipeline_id/stage_id ficam nulos. A classificação (lead/cliente/inativo) e a
 * origem são definidas no cadastro. Dados de endereço/documentos/foto são
 * completados depois, no painel de detalhe.
 */
export async function createContato(orgSlug: string, raw: unknown) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }

  if (!(await canCreateLead(org.id))) {
    return { ok: false as const, error: 'Limite de contatos atingido para o seu plano.' }
  }

  const parsed = newContatoSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }
  const { name, email, phone, status, source } = parsed.data

  const supabase = createClient()
  const { data: contato, error } = await supabase
    .from('contatos')
    .insert({
      organization_id: org.id,
      name,
      email: email || null,
      phone: phone || null,
      status,
      source: source || 'manual',
      assigned_to: user.id,
      became_customer_at: status === 'cliente' ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (error || !contato) {
    return { ok: false as const, error: error?.message || 'Erro ao criar contato' }
  }

  await supabase.from('contato_activities').insert({
    contato_id: contato.id,
    organization_id: org.id,
    type: 'manual_created',
    payload: {},
    created_by: user.id,
  })

  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const, id: contato.id }
}

/* -------- Detalhe completo para o painel master-detail -------- */


export async function getContatoPanel(orgSlug: string, contatoId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason || 'Sem permissão' }
  const supabase = createClient()

  const [{ data: contato }, { data: documents }, { data: sales }] = await Promise.all([
    supabase
      .from('contatos')
      .select('*, pipeline_stages(name)')
      .eq('id', contatoId)
      .eq('organization_id', org.id)
      .maybeSingle(),
    supabase
      .from('contato_documents')
      .select('id, kind, file_path, file_name, file_size_bytes, mime_type, created_at')
      .eq('contato_id', contatoId)
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('sales')
      .select('id, sale_date, amount_cents, status, payment_method, installments, products(name)')
      .eq('contato_id', contatoId)
      .eq('organization_id', org.id)
      .order('sale_date', { ascending: false }),
  ])

  if (!contato) return { ok: false as const, error: 'Contato não encontrado' }

  const { listRelationships } = await import('@/actions/relationships')
  const relationships = await listRelationships(orgSlug, contatoId)

  return {
    ok: true as const,
    contato,
    documents: documents || [],
    sales: sales || [],
    relationships,
  }
}

/* -------- Classificação (status) -------- */

const setStatusSchema = z.object({ status: z.enum(CONTATO_STATUSES) })

/**
 * Define a classificação do contato (lead | cliente | inativo). Marca o
 * became_customer_at na primeira vez que vira cliente; limpa ao sair de cliente.
 */
export async function setContatoStatus(orgSlug: string, contatoId: string, rawStatus: unknown) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const parsed = setStatusSchema.safeParse({ status: rawStatus })
  if (!parsed.success) return { ok: false as const, error: 'Classificação inválida.' }
  const { status } = parsed.data

  const { data: current } = await supabase
    .from('contatos')
    .select('became_customer_at')
    .eq('id', contatoId)
    .eq('organization_id', org.id)
    .maybeSingle()

  const updates: Record<string, any> = { status }
  if (status === 'cliente') {
    updates.became_customer_at = current?.became_customer_at || new Date().toISOString()
  } else {
    updates.became_customer_at = null
  }

  const { error } = await supabase
    .from('contatos')
    .update(updates)
    .eq('id', contatoId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/contatos`)
  revalidatePath(`/app/${orgSlug}/contatos/${contatoId}`)
  return { ok: true as const }
}

