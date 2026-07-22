'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { leadSchema } from '@/lib/validators/lead'
import { revalidatePath } from 'next/cache'
import { canCreateLead } from '@/lib/billing/limits'
import { isAccessBlocked } from '@/lib/billing/plans'

const FROZEN_ERROR = 'Conta em modo somente leitura (teste expirado ou assinatura cancelada). Assine um plano para continuar editando.'
import { CONTATO_STATUSES } from '@/lib/contatos'
import { z } from 'zod'

// =====================================================================
// Contatos — entidade única de contato. "cliente" é apenas um status
// (lead | cliente | inativo). Os dados antes em customer_profiles agora
// são colunas de contatos; documentos referenciam contato_id.
// =====================================================================

/* =========================================================
 *  Pipeline / lead-style operations
 * ========================================================= */

export async function createLead(orgSlug: string, formData: FormData) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  if (isAccessBlocked(org as any)) return { ok: false, error: FROZEN_ERROR }

  if (!(await canCreateLead(org.id))) {
    return { ok: false, error: 'Limite de contatos atingido para o seu plano.' }
  }

  const supabase = createClient()

  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  let stage_id = formData.get('stage_id') as string
  const value_cents_str = formData.get('value_cents') as string
  const value_cents = value_cents_str ? parseInt(value_cents_str, 10) : 0
  const tags_str = formData.get('tags') as string
  const tags = tags_str ? tags_str.split(',').map(t => t.trim()).filter(Boolean) : []

  if (!stage_id) {
    const { data: pipeline } = await supabase.from('pipelines').select('id').eq('organization_id', org.id).eq('is_default', true).maybeSingle()
    if (pipeline) {
      const { data: stage } = await supabase.from('pipeline_stages').select('id').eq('pipeline_id', pipeline.id).order('position').limit(1).maybeSingle()
      if (stage) stage_id = stage.id
    }
  }

  const validation = leadSchema.safeParse({ name, email, phone, stage_id, value_cents, tags })
  if (!validation.success) {
    return { ok: false, error: validation.error.issues[0].message }
  }

  if (!stage_id) {
    return { ok: false, error: 'Configure um pipeline com pelo menos um estágio antes de criar contatos.' }
  }

  const { data: stageInfo } = await supabase
    .from('pipeline_stages')
    .select('pipeline_id')
    .eq('id', stage_id)
    .maybeSingle()

  const { data: lead, error } = await supabase.from('contatos').insert({
    organization_id: org.id,
    pipeline_id: stageInfo?.pipeline_id,
    stage_id,
    name,
    email: email || null,
    phone: phone || null,
    value_cents,
    tags,
    assigned_to: user.id
  }).select().single()

  if (error || !lead) {
    return { ok: false, error: error?.message || 'Erro ao criar contato' }
  }

  await supabase.from('contato_activities').insert({
    contato_id: lead.id,
    organization_id: org.id,
    type: 'manual_created',
    payload: {},
    created_by: user.id
  })

  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true, lead }
}

export async function addLeadNote(orgSlug: string, leadId: string, formData: FormData) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const text = formData.get('text') as string
  if (!text || text.trim() === '') return { ok: false, error: 'Nota vazia' }

  const { error } = await supabase.from('contato_activities').insert({
    contato_id: leadId,
    organization_id: org.id,
    type: 'note',
    payload: { text },
    created_by: user.id
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/app/${orgSlug}/contatos/${leadId}`)
  return { ok: true }
}

import { inngest } from '@/lib/inngest/client'

export async function updateLead(orgSlug: string, leadId: string, formData: FormData) {
  const org = await getCurrentOrganization(orgSlug)
  if (isAccessBlocked(org as any)) return { ok: false, error: FROZEN_ERROR }
  const supabase = createClient()

  const { data: oldLead } = await supabase.from('contatos').select('tags').eq('id', leadId).maybeSingle()

  const updates: any = {}
  const name = formData.get('name') as string
  if (name) updates.name = name
  const email = formData.get('email') as string
  if (email !== null) updates.email = email || null
  const phone = formData.get('phone') as string
  if (phone !== null) updates.phone = phone || null

  let newTagsAdded: string[] = []
  const tags_str = formData.get('tags') as string
  if (tags_str !== null) {
    const newTags = tags_str ? tags_str.split(',').map(t => t.trim()).filter(Boolean) : []
    updates.tags = newTags

    const oldTags = oldLead?.tags || []
    newTagsAdded = newTags.filter(t => !oldTags.includes(t))
  }

  const stage_id = formData.get('stage_id') as string
  if (stage_id) updates.stage_id = stage_id

  const { error } = await supabase.from('contatos').update(updates).eq('id', leadId).eq('organization_id', org.id)

  if (error) return { ok: false, error: error.message }

  for (const tag of newTagsAdded) {
    await inngest.send({
      name: 'lead.tag_added',
      data: { orgId: org.id, leadId, tag }
    })
  }

  revalidatePath(`/app/${orgSlug}/contatos/${leadId}`)
  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true }
}

export async function deleteLead(orgSlug: string, leadId: string) {
  if (isImpersonating()) {
    return { ok: false, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const org = await getCurrentOrganization(orgSlug)
  if (isAccessBlocked(org as any)) return { ok: false, error: FROZEN_ERROR }
  const supabase = createClient()

  const { error } = await supabase.from('contatos').delete().eq('id', leadId).eq('organization_id', org.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true }
}

export async function moveLeadToStage(orgSlug: string, leadId: string, newStageId: string, oldStageId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  if (newStageId === oldStageId) return { ok: true }

  const [{ data: stage }, { data: lead }] = await Promise.all([
    supabase
      .from('pipeline_stages')
      .select('is_won, is_lost')
      .eq('id', newStageId)
      .maybeSingle(),
    supabase
      .from('contatos')
      .select('name, email, phone, value_cents')
      .eq('id', leadId)
      .eq('organization_id', org.id)
      .maybeSingle(),
  ])

  const { error } = await supabase
    .from('contatos')
    .update({ stage_id: newStageId, updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .eq('organization_id', org.id)

  if (error) return { ok: false, error: error.message }

  await supabase.from('contato_activities').insert({
    contato_id: leadId,
    organization_id: org.id,
    type: 'stage_changed',
    payload: { from: oldStageId, to: newStageId },
    created_by: user.id
  })

  await inngest.send({
    name: 'lead.stage_changed',
    data: { orgId: org.id, leadId, stageId: newStageId }
  })

  // ── Travel niche: auto-create a pre-filled sale when the lead is won ───────
  if (stage?.is_won) {
    const { maybeCreateTravelSaleOnWon } = await import('@/actions/travel-sales')
    await maybeCreateTravelSaleOnWon(supabase, org as any, leadId, user.id)
  }

  // ── Meta CAPI: Purchase (won) or NotQualified (lost) ──────────────────────
  if (stage && (stage.is_won || stage.is_lost) && lead) {
    try {
      const { data: orgMeta } = await supabase
        .from('organizations')
        .select('meta_pixel_id, meta_access_token')
        .eq('id', org.id)
        .maybeSingle()

      if (orgMeta?.meta_pixel_id && orgMeta?.meta_access_token) {
        const { sendCapiEvent } = await import('@/lib/meta/capi')
        await sendCapiEvent({
          pixelId:     orgMeta.meta_pixel_id,
          accessToken: orgMeta.meta_access_token,
          eventName:   stage.is_won ? 'Purchase' : 'NotQualified',
          eventId:     `${leadId}-${stage.is_won ? 'won' : 'lost'}`,
          email:       lead.email,
          phone:       lead.phone,
          firstName:   lead.name,
          ...(stage.is_won && lead.value_cents
            ? { currency: 'BRL', value: lead.value_cents / 100 }
            : {}),
        })
      }
    } catch (capiErr: any) {
      console.error('[moveLeadToStage] CAPI error:', capiErr?.message)
    }
  }

  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true }
}

export async function getLead(orgSlug: string, leadId: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: lead } = await supabase.from('contatos').select('*, pipeline_stages(name)').eq('id', leadId).eq('organization_id', org.id).maybeSingle()
  const { data: activities } = await supabase.from('contato_activities').select('*').eq('contato_id', leadId).order('created_at', { ascending: false })
  const { data: automation_runs } = await supabase.from('automation_runs').select('*, automations(name)').eq('contato_id', leadId).order('started_at', { ascending: false })

  return { lead, activities, automation_runs }
}

export async function assignLead(orgSlug: string, leadId: string, userId: string | null) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { error } = await supabase
    .from('contatos')
    .update({ assigned_to: userId })
    .eq('id', leadId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/pipeline`)
  revalidatePath(`/app/${orgSlug}/contatos/${leadId}`)
  return { ok: true as const }
}

export async function updateLeadValue(orgSlug: string, leadId: string, valueCents: number) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const supabase = createClient()

  const { error } = await supabase
    .from('contatos')
    .update({ value_cents: valueCents || null })
    .eq('id', leadId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const }
}

export async function updateLeadTags(orgSlug: string, leadId: string, tags: string[]) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const supabase = createClient()

  const clean = Array.from(new Set(
    (tags || [])
      .map(t => String(t).trim())
      .filter(Boolean)
      .map(t => t.slice(0, 40)),
  )).slice(0, 20)

  const { error } = await supabase
    .from('contatos')
    .update({ tags: clean })
    .eq('id', leadId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/pipeline`)
  revalidatePath(`/app/${orgSlug}/contatos/${leadId}`)
  return { ok: true as const, tags: clean }
}

export async function requestLeadQualification(orgSlug: string, leadId: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)

  const { runLeadQualification } = await import('@/lib/ai/run-qualification')
  const result = await runLeadQualification(leadId, org.id, null)

  if (result.ok) {
    revalidatePath(`/app/${orgSlug}/contatos/${leadId}`)
  }

  return result
}

export async function bulkUpdateLeads(
  orgSlug: string,
  leadIds: string[],
  updates: { stage_id?: string; addTag?: string; assigned_to?: string },
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  if (!leadIds.length) return { ok: true as const, count: 0 }

  const directPatch: any = {}
  if (updates.stage_id) directPatch.stage_id = updates.stage_id
  if (updates.assigned_to) directPatch.assigned_to = updates.assigned_to

  if (Object.keys(directPatch).length > 0) {
    directPatch.updated_at = new Date().toISOString()
    const { error } = await supabase
      .from('contatos')
      .update(directPatch)
      .in('id', leadIds)
      .eq('organization_id', org.id)
    if (error) return { ok: false as const, error: error.message }
  }

  if (updates.addTag) {
    const tag = updates.addTag.trim()
    if (tag) {
      const { data: rows } = await supabase
        .from('contatos')
        .select('id, tags')
        .in('id', leadIds)
        .eq('organization_id', org.id)
      for (const r of rows || []) {
        const next = Array.from(new Set([...(r.tags || []), tag]))
        await supabase.from('contatos').update({ tags: next }).eq('id', r.id).eq('organization_id', org.id)
      }
      for (const id of leadIds) {
        await inngest.send({ name: 'lead.tag_added', data: { orgId: org.id, leadId: id, tag } })
      }
    }
  }

  await supabase.from('contato_activities').insert(
    leadIds.map(leadId => ({
      contato_id: leadId,
      organization_id: org.id,
      type: 'bulk_updated',
      payload: updates,
      created_by: user.id,
    })),
  )

  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const, count: leadIds.length }
}

export async function bulkDeleteLeads(orgSlug: string, leadIds: string[]) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  if (!leadIds.length) return { ok: true as const, count: 0 }

  const { error } = await supabase
    .from('contatos')
    .delete()
    .in('id', leadIds)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const, count: leadIds.length }
}

export async function findDuplicateLead(
  orgSlug: string,
  payload: { email?: string; phone?: string },
) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const email = (payload.email || '').trim().toLowerCase()
  const phone = (payload.phone || '').replace(/\D/g, '')

  if (!email && !phone) return { match: null }

  const filters: string[] = []
  if (email) filters.push(`email.eq.${email}`)
  if (phone) filters.push(`phone.eq.${phone}`)

  const { data } = await supabase
    .from('contatos')
    .select('id, name, email, phone')
    .eq('organization_id', org.id)
    .or(filters.join(','))
    .limit(1)
    .maybeSingle()

  return { match: data || null }
}

export async function searchLeads(orgSlug: string, query: string, limit = 20) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const q = (query || '').trim()
  let builder = supabase
    .from('contatos')
    .select('id, name, email, phone')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (q) {
    const safe = q.replace(/[%_]/g, '\\$&')
    builder = builder.or(`name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`)
  }

  const { data, error } = await builder
  if (error) {
    console.error('searchLeads error:', error)
    return []
  }
  return data || []
}

/* =========================================================
 *  Cliente-style operations (status = 'cliente')
 *  Os campos de cadastro agora vivem direto em contatos.
 * ========================================================= */

const ALLOWED_DOC_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf',
])
const MAX_DOC_SIZE = 10 * 1024 * 1024

export type CustomerListRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  city: string | null
  state: string | null
  has_documents: boolean
  total_purchased_cents: number
  last_purchase_at: string | null
  became_customer_at: string | null
  assigned_to: string | null
}

export async function listCustomers(orgSlug: string): Promise<CustomerListRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: leads } = await supabase
    .from('contatos')
    .select('id, name, email, phone, city, state, became_customer_at, assigned_to')
    .eq('organization_id', org.id)
    .eq('status', 'cliente')
    .order('became_customer_at', { ascending: false })
    .limit(500)

  if (!leads || leads.length === 0) return []

  const leadIds = leads.map(l => l.id)
  const [{ data: sales }, { data: docs }] = await Promise.all([
    supabase
      .from('sales')
      .select('contato_id, amount_cents, sale_date')
      .eq('organization_id', org.id)
      .eq('status', 'completed')
      .in('contato_id', leadIds),
    supabase
      .from('contato_documents')
      .select('contato_id')
      .eq('organization_id', org.id)
      .in('contato_id', leadIds),
  ])

  const totalByLead = new Map<string, { total: number; last: string | null }>()
  for (const s of sales || []) {
    if (!s.contato_id) continue
    const cur = totalByLead.get(s.contato_id) || { total: 0, last: null }
    cur.total += s.amount_cents || 0
    const sDate = s.sale_date as string
    if (!cur.last || sDate > cur.last) cur.last = sDate
    totalByLead.set(s.contato_id, cur)
  }

  const contatosWithDocs = new Set((docs || []).map(d => d.contato_id))

  return leads.map(l => {
    const tally = totalByLead.get(l.id) || { total: 0, last: null }
    return {
      id: l.id,
      name: l.name,
      email: l.email,
      phone: l.phone,
      city: l.city || null,
      state: l.state || null,
      has_documents: contatosWithDocs.has(l.id),
      total_purchased_cents: tally.total,
      last_purchase_at: tally.last,
      became_customer_at: l.became_customer_at,
      assigned_to: l.assigned_to,
    }
  })
}

export async function getCustomer(orgSlug: string, leadId: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const [{ data: lead }, { data: sales }, { data: activities }, { data: documents }] = await Promise.all([
    supabase
      .from('contatos')
      .select('*, pipeline_stages(name)')
      .eq('id', leadId)
      .eq('organization_id', org.id)
      .maybeSingle(),
    supabase
      .from('sales')
      .select('id, sale_date, amount_cents, quantity, status, payment_method, installments, notes, products(name)')
      .eq('contato_id', leadId)
      .eq('organization_id', org.id)
      .order('sale_date', { ascending: false }),
    supabase
      .from('contato_activities')
      .select('id, type, payload, created_at')
      .eq('contato_id', leadId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('contato_documents')
      .select('id, kind, file_path, file_name, file_size_bytes, mime_type, created_at')
      .eq('contato_id', leadId)
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false }),
  ])

  if (!lead) return null

  return {
    lead,
    // Os campos de cadastro vivem no próprio contato; expomos como `profile`
    // para compatibilidade com os componentes de detalhe.
    profile: lead,
    sales: sales || [],
    activities: activities || [],
    documents: documents || [],
  }
}

/* -------- Cadastro (dados de contato) -------- */

const profileSchema = z.object({
  cpf: z.string().optional().nullable(),
  rg: z.string().optional().nullable(),
  passport_number: z.string().optional().nullable(),
  passport_expiry: z.string().optional().nullable(),
  has_us_visa: z.boolean().optional(),
  date_of_birth: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  number: z.string().optional().nullable(),
  complement: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  address_notes: z.string().optional().nullable(),
})

/**
 * Atualiza os dados de cadastro (CPF, endereço, passaporte...) direto no
 * contato. Mantém o nome `upsertCustomerProfile` por compatibilidade.
 */
export async function upsertCustomerProfile(orgSlug: string, leadId: string, raw: unknown) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const parsed = profileSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  const data: Record<string, any> = { ...parsed.data }
  for (const k of Object.keys(data)) {
    if (data[k] === '') data[k] = null
  }

  const { error } = await supabase
    .from('contatos')
    .update(data)
    .eq('id', leadId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/contatos/${leadId}`)
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
  const org = await getCurrentOrganization(orgSlug)
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
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
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

/* -------- Foto do contato (avatar) -------- */

const ALLOWED_AVATAR_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
const MAX_AVATAR_SIZE = 5 * 1024 * 1024

export async function uploadContatoAvatar(
  orgSlug: string,
  contatoId: string,
  formData: FormData,
) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const file = formData.get('file') as File | null
  if (!file || typeof file !== 'object') return { ok: false as const, error: 'Arquivo ausente' }
  if (!ALLOWED_AVATAR_MIME.has(file.type)) {
    return { ok: false as const, error: 'Use uma imagem PNG, JPG ou WebP.' }
  }
  if (file.size > MAX_AVATAR_SIZE) {
    return { ok: false as const, error: 'Imagem muito grande (máx. 5MB).' }
  }

  const { data: contato } = await supabase
    .from('contatos')
    .select('id, avatar_url')
    .eq('id', contatoId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!contato) return { ok: false as const, error: 'Contato não encontrado' }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${org.id}/${contatoId}/${Date.now()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('contato-avatars')
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false })
  if (uploadError) return { ok: false as const, error: uploadError.message }

  const { data: pub } = supabase.storage.from('contato-avatars').getPublicUrl(path)
  const publicUrl = pub.publicUrl

  const { error: updateError } = await supabase
    .from('contatos')
    .update({ avatar_url: publicUrl })
    .eq('id', contatoId)
    .eq('organization_id', org.id)
  if (updateError) {
    await supabase.storage.from('contato-avatars').remove([path])
    return { ok: false as const, error: updateError.message }
  }

  // Remove a foto anterior (best-effort) para não acumular lixo no bucket.
  if (contato.avatar_url) {
    const marker = '/contato-avatars/'
    const idx = contato.avatar_url.indexOf(marker)
    if (idx >= 0) {
      const oldPath = contato.avatar_url.slice(idx + marker.length)
      if (oldPath && oldPath !== path) {
        await supabase.storage.from('contato-avatars').remove([oldPath])
      }
    }
  }

  revalidatePath(`/app/${orgSlug}/contatos`)
  revalidatePath(`/app/${orgSlug}/contatos/${contatoId}`)
  return { ok: true as const, url: publicUrl }
}

export async function removeContatoAvatar(orgSlug: string, contatoId: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: contato } = await supabase
    .from('contatos')
    .select('avatar_url')
    .eq('id', contatoId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!contato) return { ok: false as const, error: 'Contato não encontrado' }

  const { error } = await supabase
    .from('contatos')
    .update({ avatar_url: null })
    .eq('id', contatoId)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  if (contato.avatar_url) {
    const marker = '/contato-avatars/'
    const idx = contato.avatar_url.indexOf(marker)
    if (idx >= 0) {
      const oldPath = contato.avatar_url.slice(idx + marker.length)
      if (oldPath) await supabase.storage.from('contato-avatars').remove([oldPath])
    }
  }

  revalidatePath(`/app/${orgSlug}/contatos`)
  revalidatePath(`/app/${orgSlug}/contatos/${contatoId}`)
  return { ok: true as const }
}

/* -------- Status de cliente (marcar / desmarcar) -------- */

export async function markAsCustomer(orgSlug: string, leadId: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { error } = await supabase
    .from('contatos')
    .update({ status: 'cliente', became_customer_at: new Date().toISOString() })
    .eq('id', leadId)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const }
}

export async function unmarkAsCustomer(orgSlug: string, leadId: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { error } = await supabase
    .from('contatos')
    .update({ status: 'lead', became_customer_at: null })
    .eq('id', leadId)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const }
}

/* -------- Documentos -------- */

const DOC_KINDS = ['cpf_front', 'cpf_back', 'rg_front', 'rg_back', 'address_proof', 'contract', 'other'] as const

export async function uploadCustomerDocument(
  orgSlug: string,
  contatoId: string,
  formData: FormData,
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const file = formData.get('file') as File | null
  const kindRaw = String(formData.get('kind') || 'other')
  const kind = (DOC_KINDS as readonly string[]).includes(kindRaw) ? kindRaw : 'other'

  if (!file || typeof file !== 'object') return { ok: false as const, error: 'Arquivo ausente' }
  if (!ALLOWED_DOC_MIME.has(file.type)) {
    return { ok: false as const, error: `Tipo não permitido: ${file.type}. Use PNG, JPG, WebP ou PDF.` }
  }
  if (file.size > MAX_DOC_SIZE) {
    return { ok: false as const, error: `Arquivo muito grande (>${MAX_DOC_SIZE / 1024 / 1024}MB)` }
  }

  // Verifica se o contato pertence a esta org (RLS também garante no insert).
  const { data: contato } = await supabase
    .from('contatos')
    .select('id')
    .eq('id', contatoId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!contato) return { ok: false as const, error: 'Contato não encontrado' }

  const rawName = file.name || 'documento'
  const dotIdx = rawName.lastIndexOf('.')
  const ext = dotIdx > 0 ? rawName.slice(dotIdx + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin'
  const base = (dotIdx > 0 ? rawName.slice(0, dotIdx) : rawName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'doc'

  // Layout do path alinhado à policy: `{org_id}/{contato_id}/{filename}`.
  const path = `${org.id}/${contatoId}/${Date.now()}-${kind}-${base}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('customer-documents')
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('uploadCustomerDocument storage error:', uploadError)
    return { ok: false as const, error: uploadError.message }
  }

  const { error: insertError } = await supabase.from('contato_documents').insert({
    contato_id: contatoId,
    organization_id: org.id,
    kind,
    file_path: path,
    file_name: rawName,
    file_size_bytes: file.size,
    mime_type: file.type,
    uploaded_by: user.id,
  })

  if (insertError) {
    await supabase.storage.from('customer-documents').remove([path])
    return { ok: false as const, error: insertError.message }
  }

  revalidatePath(`/app/${orgSlug}/contatos/${contatoId}`)
  return { ok: true as const }
}

export async function deleteCustomerDocument(orgSlug: string, documentId: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: doc } = await supabase
    .from('contato_documents')
    .select('id, file_path')
    .eq('id', documentId)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!doc) return { ok: false as const, error: 'Documento não encontrado' }

  const { error: dbError } = await supabase
    .from('contato_documents')
    .delete()
    .eq('id', documentId)
    .eq('organization_id', org.id)
  if (dbError) return { ok: false as const, error: dbError.message }

  await supabase.storage.from('customer-documents').remove([doc.file_path])

  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const }
}

export async function getDocumentSignedUrl(orgSlug: string, documentId: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: doc } = await supabase
    .from('contato_documents')
    .select('file_path')
    .eq('id', documentId)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!doc) return { ok: false as const, error: 'Documento não encontrado' }

  const { data: signed, error } = await supabase.storage
    .from('customer-documents')
    .createSignedUrl(doc.file_path, 60 * 5) // 5 min

  if (error || !signed?.signedUrl) {
    return { ok: false as const, error: error?.message || 'Não foi possível assinar URL' }
  }
  return { ok: true as const, url: signed.signedUrl }
}

// =====================================================================
// Registros de viagem vinculados a um contato (para os atalhos da lista:
// "Cotações enviadas" e "Reservas"). Carregado sob demanda quando o popup
// é aberto, evitando consultas por linha na listagem.
// =====================================================================

export type ContatoQuoteLink = {
  id: string
  title: string | null
  client_name: string | null
  status: string | null
  total_cents: number | null
  created_at: string | null
  public_token: string | null
}

export type ContatoReservationLink = {
  id: string
  client_name: string | null
  destination: string | null
  status: string | null
  total_cents: number | null
  departure_date: string | null
  created_at: string | null
}

export async function getContatoTravelLinks(orgSlug: string, contatoId: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const [{ data: quotes }, { data: reservations }] = await Promise.all([
    supabase
      .from('travel_proposals')
      .select('id, title, client_name, status, total_cents, created_at, public_token')
      .eq('organization_id', org.id)
      .eq('contato_id', contatoId)
      .order('created_at', { ascending: false }),
    supabase
      .from('travel_sales')
      .select('id, client_name, destination, status, total_cents, departure_date, created_at')
      .eq('organization_id', org.id)
      .eq('contato_id', contatoId)
      .order('created_at', { ascending: false }),
  ])

  return {
    quotes: (quotes || []) as ContatoQuoteLink[],
    reservations: (reservations || []) as ContatoReservationLink[],
  }
}
