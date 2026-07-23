'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

export type FinancialEntryRow = {
  id: string
  organization_id: string
  tipo: 'receita' | 'despesa'
  categoria: string
  subcategoria: string | null
  centro_custo: string | null
  conta_bancaria: string | null
  forma_pagamento: string | null
  valor_cents: number
  competencia: string
  vencimento: string | null
  data_pagamento: string | null
  status: 'pendente' | 'pago' | 'vencido' | 'cancelado'
  contato_id: string | null
  venda_id: string | null
  operadora: string | null
  observacoes: string | null
  tags: string[]
  anexos: { path: string; name: string; size_bytes: number; mime_type: string }[]
  is_recurring: boolean
  recurrence_group_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Soma N meses a uma data ISO (YYYY-MM-DD), preservando o dia (clampado ao
 *  último dia do mês de destino — ex.: 31/01 + 1 mês vira 28/02 ou 29/02). */
function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate()
  dt.setUTCDate(Math.min(d, lastDay))
  return dt.toISOString().slice(0, 10)
}

/** Quantas ocorrências futuras gerar de uma vez ao marcar um lançamento como recorrente. */
const RECURRING_MONTHS_AHEAD = 11

/**
 * "Vencido" não é um status gravado por um cron — é derivado na leitura:
 * um lançamento pendente cujo vencimento já passou aparece como vencido
 * pra quem consulta, sem precisar de job agendado. Se o usuário salvar o
 * lançamento nesse estado (mesmo sem mudar nada), o valor computado é
 * persistido normalmente via updateFinancialEntry.
 */
function withEffectiveStatus<T extends { status: FinancialEntryRow['status']; vencimento: string | null }>(entry: T): T {
  if (entry.status === 'pendente' && entry.vencimento) {
    const today = new Date().toISOString().slice(0, 10)
    if (entry.vencimento < today) return { ...entry, status: 'vencido' }
  }
  return entry
}

const WRITABLE = [
  'tipo', 'categoria', 'subcategoria', 'centro_custo', 'conta_bancaria', 'forma_pagamento',
  'valor_cents', 'competencia', 'vencimento', 'data_pagamento', 'status',
  'contato_id', 'venda_id', 'operadora', 'observacoes', 'tags', 'is_recurring',
] as const

function pick(input: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const k of WRITABLE) if (k in input) out[k] = input[k]
  if ('valor_cents' in out) {
    const n = Number(out.valor_cents)
    out.valor_cents = Number.isFinite(n) ? Math.round(n) : 0
  }
  for (const k of ['vencimento', 'data_pagamento'] as const) {
    if (k in out && !out[k]) out[k] = null
  }
  for (const k of ['contato_id', 'venda_id'] as const) {
    if (k in out && !out[k]) out[k] = null
  }
  return out
}

export async function listFinancialEntries(
  orgSlug: string,
  filters?: { tipo?: string; categoria?: string; status?: string; from?: string; to?: string; contatoId?: string },
): Promise<FinancialEntryRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  let query = supabase
    .from('financial_entries')
    .select('*')
    .eq('organization_id', org.id)

  if (filters?.tipo) query = query.eq('tipo', filters.tipo)
  if (filters?.categoria) query = query.eq('categoria', filters.categoria)
  if (filters?.contatoId) query = query.eq('contato_id', filters.contatoId)
  if (filters?.from) query = query.gte('competencia', filters.from)
  if (filters?.to) query = query.lte('competencia', filters.to)

  const today = new Date().toISOString().slice(0, 10)
  if (filters?.status === 'vencido') {
    query = query.or(`status.eq.vencido,and(status.eq.pendente,vencimento.lt.${today})`)
  } else if (filters?.status === 'pendente') {
    query = query.eq('status', 'pendente').or(`vencimento.is.null,vencimento.gte.${today}`)
  } else if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  const { data } = await query.order('competencia', { ascending: false }).limit(1000)
  return ((data as FinancialEntryRow[]) ?? []).map(withEffectiveStatus)
}

export async function getFinancialEntry(orgSlug: string, id: string): Promise<FinancialEntryRow | null> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('financial_entries')
    .select('*')
    .eq('organization_id', org.id)
    .eq('id', id)
    .maybeSingle()
  return data ? withEffectiveStatus(data as FinancialEntryRow) : null
}

export async function createFinancialEntry(orgSlug: string, input: Record<string, any>) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  if (input.tipo !== 'receita' && input.tipo !== 'despesa') {
    return { ok: false as const, error: 'Informe o tipo (receita ou despesa).' }
  }
  if (!input.categoria?.trim()) return { ok: false as const, error: 'Informe a categoria.' }
  if (!input.valor_cents || Number(input.valor_cents) <= 0) {
    return { ok: false as const, error: 'Informe um valor válido.' }
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('financial_entries')
    .insert({
      organization_id: org.id,
      created_by: user.id,
      ...pick(input),
    })
    .select()
    .single()

  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao criar lançamento' }

  // Despesa/receita recorrente: gera de uma vez as próximas ocorrências
  // mensais (mesmo dia, mês seguinte em diante), já pendentes, agrupadas
  // pelo id do lançamento original — assim aparecem prontas nos meses
  // seguintes sem precisar recadastrar.
  if (data.is_recurring) {
    await supabase.from('financial_entries').update({ recurrence_group_id: data.id }).eq('id', data.id)

    const future = Array.from({ length: RECURRING_MONTHS_AHEAD }, (_, i) => {
      const offset = i + 1
      return {
        organization_id: org.id,
        created_by: user.id,
        recurrence_group_id: data.id,
        is_recurring: true,
        tipo: data.tipo,
        categoria: data.categoria,
        subcategoria: data.subcategoria,
        centro_custo: data.centro_custo,
        conta_bancaria: data.conta_bancaria,
        forma_pagamento: data.forma_pagamento,
        valor_cents: data.valor_cents,
        competencia: addMonthsIso(data.competencia, offset),
        vencimento: data.vencimento ? addMonthsIso(data.vencimento, offset) : null,
        data_pagamento: null,
        status: 'pendente' as const,
        contato_id: data.contato_id,
        operadora: data.operadora,
        observacoes: data.observacoes,
        tags: data.tags ?? [],
      }
    })
    await supabase.from('financial_entries').insert(future)
  }

  revalidatePath(`/app/${orgSlug}/financeiro`)
  return { ok: true as const, data: withEffectiveStatus(data as FinancialEntryRow) }
}

export async function updateFinancialEntry(orgSlug: string, id: string, input: Record<string, any>) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('financial_entries')
    .update(pick(input))
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao salvar lançamento' }

  revalidatePath(`/app/${orgSlug}/financeiro`)
  return { ok: true as const, data: withEffectiveStatus(data as FinancialEntryRow) }
}

export async function deleteFinancialEntry(orgSlug: string, id: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()

  const { data: entry } = await supabase
    .from('financial_entries')
    .select('anexos')
    .eq('id', id)
    .eq('organization_id', org.id)
    .maybeSingle()

  const { error } = await supabase
    .from('financial_entries')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message || 'Erro ao excluir lançamento' }

  const anexos = (entry as any)?.anexos as FinancialEntryRow['anexos'] | undefined
  if (anexos?.length) {
    await supabase.storage.from('financial-attachments').remove(anexos.map(a => a.path))
  }

  revalidatePath(`/app/${orgSlug}/financeiro`)
  return { ok: true as const }
}

/** Import em lote (CSV de extrato bancário). Linhas inválidas são ignoradas silenciosamente — a validação já ocorreu no preview do importador. */
export async function bulkCreateFinancialEntries(
  orgSlug: string,
  rows: { tipo: 'receita' | 'despesa'; categoria: string; valor_cents: number; competencia: string; observacoes?: string | null }[],
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const valid = rows.filter(r =>
    (r.tipo === 'receita' || r.tipo === 'despesa') && r.categoria?.trim() && r.valor_cents > 0 && r.competencia,
  )
  if (valid.length === 0) return { ok: false as const, error: 'Nenhuma linha válida para importar.' }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('financial_entries')
    .insert(valid.map(r => ({
      organization_id: org.id,
      created_by: user.id,
      tipo: r.tipo,
      categoria: r.categoria.trim(),
      valor_cents: Math.round(r.valor_cents),
      competencia: r.competencia,
      observacoes: r.observacoes?.trim() || null,
      status: 'pago' as const,
      data_pagamento: r.competencia,
    })))
    .select('id')

  if (error) return { ok: false as const, error: error.message || 'Erro ao importar lançamentos' }

  revalidatePath(`/app/${orgSlug}/financeiro`)
  return { ok: true as const, count: data?.length ?? 0 }
}

/**
 * Sugestão de categoria por IA — classificação de texto simples (descrição
 * → categoria), sem OCR/visão. Usa o token centralizado da plataforma
 * (lib/ai/api-key.ts), mesmo modelo usado no qualificador de leads.
 */
export async function suggestCategoryForEntry(
  orgSlug: string,
  input: { descricao: string; tipo: 'receita' | 'despesa' },
): Promise<{ ok: true; categoria: string; confidence: number } | { ok: false; error: string }> {
  await getCurrentOrganization(orgSlug)

  if (!input.descricao?.trim()) return { ok: false, error: 'Informe uma descrição para sugerir a categoria.' }

  const { getPlatformAiKey, hasPlatformAiKey } = await import('@/lib/ai/api-key')
  if (!hasPlatformAiKey()) return { ok: false, error: 'IA não configurada.' }

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey: getPlatformAiKey() })

  const CATEGORIZE_TOOL: any = {
    name: 'categorize_entry',
    description: 'Sugere a categoria financeira mais provável para um lançamento de agência de viagens.',
    input_schema: {
      type: 'object',
      properties: {
        categoria: { type: 'string', description: 'Nome curto da categoria sugerida, ex.: "Comissão", "Marketing", "Passagens aéreas", "Reembolso", "Taxas bancárias"' },
        confidence: { type: 'number', description: 'Confiança de 0 a 1' },
      },
      required: ['categoria', 'confidence'],
    },
  }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: 'Você categoriza lançamentos financeiros de uma agência de viagens brasileira. Responda sempre com a ferramenta categorize_entry.',
      messages: [{
        role: 'user',
        content: `Tipo: ${input.tipo}\nDescrição: ${input.descricao.trim()}`,
      }],
      tools: [CATEGORIZE_TOOL],
      tool_choice: { type: 'tool', name: 'categorize_entry' },
    })

    const toolBlock = response.content.find((b): b is any => b.type === 'tool_use')
    if (!toolBlock) return { ok: false, error: 'IA não retornou sugestão.' }

    const categoria = typeof toolBlock.input.categoria === 'string' ? toolBlock.input.categoria.slice(0, 60) : ''
    const confidence = Math.max(0, Math.min(1, Number(toolBlock.input.confidence) || 0))
    if (!categoria) return { ok: false, error: 'IA não retornou categoria.' }

    return { ok: true, categoria, confidence }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro ao consultar IA.' }
  }
}

const ATTACHMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024

export async function uploadFinancialAttachment(orgSlug: string, entryId: string, formData: FormData) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { ok: false as const, error: 'Arquivo vazio' }
  if (!ATTACHMENT_TYPES.includes(file.type)) {
    return { ok: false as const, error: 'Formato não suportado. Use PDF, JPG, PNG ou WebP.' }
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return { ok: false as const, error: 'Arquivo muito grande. O limite é 15 MB.' }
  }

  const supabase = createClient()
  const { data: entry } = await supabase
    .from('financial_entries')
    .select('anexos')
    .eq('id', entryId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!entry) return { ok: false as const, error: 'Lançamento não encontrado.' }

  const extMap: Record<string, string> = {
    'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  }
  const ext = extMap[file.type] ?? 'bin'
  const path = `${org.id}/${entryId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const name = (file.name || `anexo.${ext}`).replace(/[\r\n"]/g, '').slice(0, 120)

  const bytes = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('financial-attachments')
    .upload(path, bytes, { contentType: file.type, upsert: false })
  if (uploadError) return { ok: false as const, error: uploadError.message }

  const anexos = [...((entry as any).anexos || []), { path, name, size_bytes: file.size, mime_type: file.type }]
  const { error: updateError } = await supabase
    .from('financial_entries')
    .update({ anexos })
    .eq('id', entryId)
    .eq('organization_id', org.id)
  if (updateError) {
    await supabase.storage.from('financial-attachments').remove([path])
    return { ok: false as const, error: updateError.message }
  }

  revalidatePath(`/app/${orgSlug}/financeiro`)
  return { ok: true as const, anexos }
}

export async function deleteFinancialAttachment(orgSlug: string, entryId: string, path: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data: entry } = await supabase
    .from('financial_entries')
    .select('anexos')
    .eq('id', entryId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!entry) return { ok: false as const, error: 'Lançamento não encontrado.' }

  const anexos = ((entry as any).anexos || []).filter((a: any) => a.path !== path)
  const { error } = await supabase
    .from('financial_entries')
    .update({ anexos })
    .eq('id', entryId)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  await supabase.storage.from('financial-attachments').remove([path])

  revalidatePath(`/app/${orgSlug}/financeiro`)
  return { ok: true as const, anexos }
}

export async function getFinancialAttachmentUrl(orgSlug: string, entryId: string, path: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: entry } = await supabase
    .from('financial_entries')
    .select('anexos')
    .eq('id', entryId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!entry) return { ok: false as const, error: 'Lançamento não encontrado.' }

  const found = ((entry as any).anexos || []).some((a: any) => a.path === path)
  if (!found) return { ok: false as const, error: 'Anexo não encontrado.' }

  const { data: signed, error } = await supabase.storage
    .from('financial-attachments')
    .createSignedUrl(path, 60 * 5)

  if (error || !signed?.signedUrl) return { ok: false as const, error: error?.message || 'Não foi possível assinar URL' }
  return { ok: true as const, url: signed.signedUrl }
}

// ── Agregações do dashboard ──────────────────────────────────────────────────

export async function getFinancialSummary(
  orgSlug: string,
  range: { from: string; to: string },
): Promise<{ receitas_cents: number; despesas_cents: number; saldo_cents: number }> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('financial_entries')
    .select('tipo, valor_cents')
    .eq('organization_id', org.id)
    .gte('competencia', range.from)
    .lte('competencia', range.to)
    .neq('status', 'cancelado')

  let receitas_cents = 0
  let despesas_cents = 0
  for (const row of data || []) {
    if (row.tipo === 'receita') receitas_cents += row.valor_cents
    else despesas_cents += row.valor_cents
  }
  return { receitas_cents, despesas_cents, saldo_cents: receitas_cents - despesas_cents }
}

export async function getCashFlowSeries(
  orgSlug: string,
  months = 6,
): Promise<{ month: string; receitas_cents: number; despesas_cents: number }[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
  const fromStr = from.toISOString().slice(0, 10)

  const { data } = await supabase
    .from('financial_entries')
    .select('tipo, valor_cents, competencia')
    .eq('organization_id', org.id)
    .gte('competencia', fromStr)
    .neq('status', 'cancelado')

  const buckets = new Map<string, { receitas_cents: number; despesas_cents: number }>()
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets.set(key, { receitas_cents: 0, despesas_cents: 0 })
  }

  for (const row of data || []) {
    const key = row.competencia.slice(0, 7)
    const bucket = buckets.get(key)
    if (!bucket) continue
    if (row.tipo === 'receita') bucket.receitas_cents += row.valor_cents
    else bucket.despesas_cents += row.valor_cents
  }

  return Array.from(buckets.entries()).map(([month, v]) => ({ month, ...v }))
}

export async function getExpensesByCategory(
  orgSlug: string,
  range: { from: string; to: string },
): Promise<{ categoria: string; valor_cents: number }[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('financial_entries')
    .select('categoria, valor_cents')
    .eq('organization_id', org.id)
    .eq('tipo', 'despesa')
    .neq('status', 'cancelado')
    .gte('competencia', range.from)
    .lte('competencia', range.to)

  const byCategory = new Map<string, number>()
  for (const row of data || []) {
    byCategory.set(row.categoria, (byCategory.get(row.categoria) || 0) + row.valor_cents)
  }
  return Array.from(byCategory.entries())
    .map(([categoria, valor_cents]) => ({ categoria, valor_cents }))
    .sort((a, b) => b.valor_cents - a.valor_cents)
}

export async function getSimpleDRE(
  orgSlug: string,
  range: { from: string; to: string },
): Promise<{ receita_total_cents: number; despesas_por_categoria: { categoria: string; valor_cents: number }[]; resultado_cents: number }> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('financial_entries')
    .select('tipo, categoria, valor_cents')
    .eq('organization_id', org.id)
    .neq('status', 'cancelado')
    .gte('competencia', range.from)
    .lte('competencia', range.to)

  let receita_total_cents = 0
  const despesasMap = new Map<string, number>()
  for (const row of data || []) {
    if (row.tipo === 'receita') {
      receita_total_cents += row.valor_cents
    } else {
      despesasMap.set(row.categoria, (despesasMap.get(row.categoria) || 0) + row.valor_cents)
    }
  }
  const despesas_por_categoria = Array.from(despesasMap.entries())
    .map(([categoria, valor_cents]) => ({ categoria, valor_cents }))
    .sort((a, b) => b.valor_cents - a.valor_cents)
  const despesas_total_cents = despesas_por_categoria.reduce((a, d) => a + d.valor_cents, 0)

  return { receita_total_cents, despesas_por_categoria, resultado_cents: receita_total_cents - despesas_total_cents }
}

export async function getDailyCashFlow(
  orgSlug: string,
  range: { from: string; to: string },
): Promise<{ day: string; receitas_cents: number; despesas_cents: number; saldo_cents: number }[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('financial_entries')
    .select('tipo, valor_cents, competencia')
    .eq('organization_id', org.id)
    .neq('status', 'cancelado')
    .gte('competencia', range.from)
    .lte('competencia', range.to)

  const buckets = new Map<string, { receitas_cents: number; despesas_cents: number }>()
  const start = new Date(range.from + 'T12:00:00')
  const end = new Date(range.to + 'T12:00:00')
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    buckets.set(d.toISOString().slice(0, 10), { receitas_cents: 0, despesas_cents: 0 })
  }

  for (const row of data || []) {
    const bucket = buckets.get(row.competencia)
    if (!bucket) continue
    if (row.tipo === 'receita') bucket.receitas_cents += row.valor_cents
    else bucket.despesas_cents += row.valor_cents
  }

  let running = 0
  return Array.from(buckets.entries()).map(([day, v]) => {
    running += v.receitas_cents - v.despesas_cents
    return { day, ...v, saldo_cents: running }
  })
}

export type UpcomingDueEntry = {
  id: string
  tipo: 'receita' | 'despesa'
  categoria: string
  valor_cents: number
  vencimento: string
  status: FinancialEntryRow['status']
}

export async function getUpcomingDueEntries(orgSlug: string, days = 30): Promise<UpcomingDueEntry[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const today = new Date()
  const limit = new Date(today)
  limit.setDate(limit.getDate() + days)

  const { data } = await supabase
    .from('financial_entries')
    .select('id, tipo, categoria, valor_cents, vencimento, status')
    .eq('organization_id', org.id)
    .in('status', ['pendente', 'vencido'])
    .not('vencimento', 'is', null)
    .lte('vencimento', limit.toISOString().slice(0, 10))
    .order('vencimento', { ascending: true })
    .limit(50)

  return ((data as UpcomingDueEntry[]) ?? []).map(e => withEffectiveStatus(e as any)) as UpcomingDueEntry[]
}

export async function getFinancialDashboardData(orgSlug: string, range: { from: string; to: string }) {
  const [summary, monthlyCashFlow, dailyCashFlow, expensesByCategory, dre, upcomingDue] = await Promise.all([
    getFinancialSummary(orgSlug, range),
    getCashFlowSeries(orgSlug, 6),
    getDailyCashFlow(orgSlug, range),
    getExpensesByCategory(orgSlug, range),
    getSimpleDRE(orgSlug, range),
    getUpcomingDueEntries(orgSlug),
  ])
  return { summary, monthlyCashFlow, dailyCashFlow, expensesByCategory, dre, upcomingDue }
}
