'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import { parseDate } from '@/lib/csv'

/** Escapa um valor pra célula CSV (aspas duplas + separador). */
function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(csvCell).join(','), ...rows.map(r => r.map(csvCell).join(','))]
  return '﻿' + lines.join('\r\n') // BOM — abre certo no Excel com acento
}

// ── Export ───────────────────────────────────────────────────────────────────

export async function exportContatosCsv(orgSlug: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('contatos')
    .select('name, email, phone, status, source, tags, value_cents, city, state, created_at')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })

  const rows = (data ?? []).map(c => [
    c.name, c.email, c.phone, c.status, c.source, (c.tags || []).join('|'),
    c.value_cents != null ? (c.value_cents / 100).toFixed(2) : '', c.city, c.state,
    c.created_at?.slice(0, 10),
  ])
  return toCsv(
    ['nome', 'email', 'telefone', 'status', 'origem', 'tags', 'valor', 'cidade', 'estado', 'criado_em'],
    rows,
  )
}

export async function exportTravelSalesCsv(orgSlug: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('travel_sales')
    .select('client_name, destination, departure_date, return_date, hotel_name, airline, operator, total_cents, commission_cents, status, notes, created_at, contatos(phone, email)')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })

  const rows = (data ?? []).map((s: any) => [
    s.client_name, s.contatos?.phone, s.contatos?.email, s.destination, s.departure_date, s.return_date,
    s.hotel_name, s.airline, s.operator,
    s.total_cents != null ? (s.total_cents / 100).toFixed(2) : '',
    s.commission_cents != null ? (s.commission_cents / 100).toFixed(2) : '',
    s.status, s.notes, s.created_at?.slice(0, 10),
  ])
  return toCsv(
    ['cliente_nome', 'cliente_telefone', 'cliente_email', 'destino', 'data_ida', 'data_volta',
      'hotel', 'companhia_aerea', 'operadora', 'valor_total', 'comissao', 'status', 'observacoes', 'criado_em'],
    rows,
  )
}

// ── Import ───────────────────────────────────────────────────────────────────

export type ImportContatoRow = {
  nome: string; email?: string; telefone?: string; status?: string; origem?: string; tags?: string
}

export async function bulkImportContatos(orgSlug: string, rows: ImportContatoRow[]) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const validStatus = new Set(['lead', 'cliente', 'inativo'])
  let imported = 0
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const name = row.nome?.trim()
    if (!name) { errors.push(`Linha ${i + 2}: nome é obrigatório.`); continue }
    const status = row.status?.trim().toLowerCase()
    const { error } = await supabase.from('contatos').insert({
      organization_id: org.id,
      name,
      email: row.email?.trim() || null,
      phone: row.telefone?.trim() || null,
      status: status && validStatus.has(status) ? status : 'lead',
      source: row.origem?.trim() || 'Importação',
      tags: row.tags ? row.tags.split('|').map((t: string) => t.trim()).filter(Boolean) : [],
      assigned_to: user.id,
    })
    if (error) errors.push(`Linha ${i + 2} (${name}): ${error.message}`)
    else imported++
  }

  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const, imported, errors }
}

export type ImportSaleRow = {
  cliente_nome?: string; cliente_telefone?: string; cliente_email?: string
  destino?: string; data_ida?: string; data_volta?: string
  hotel?: string; companhia_aerea?: string; operadora?: string
  valor_total?: string; comissao?: string; status?: string; observacoes?: string
}

function toCents(v?: string): number | null {
  if (!v) return null
  const n = Number(v.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : null
}

export async function bulkImportTravelSales(orgSlug: string, rows: ImportSaleRow[]) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const validStatus = new Set(['open', 'closed', 'canceled'])
  let imported = 0
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const phone = row.cliente_telefone?.trim() || null
    const email = row.cliente_email?.trim() || null
    const name = row.cliente_nome?.trim() || null

    if (!phone && !email && !name) {
      errors.push(`Linha ${i + 2}: informe ao menos nome, telefone ou e-mail do cliente.`)
      continue
    }

    // Tenta achar o contato por telefone, depois e-mail, depois nome exato.
    let contatoId: string | null = null
    if (phone) {
      const { data } = await supabase.from('contatos').select('id').eq('organization_id', org.id).eq('phone', phone).maybeSingle()
      contatoId = data?.id ?? null
    }
    if (!contatoId && email) {
      const { data } = await supabase.from('contatos').select('id').eq('organization_id', org.id).eq('email', email).maybeSingle()
      contatoId = data?.id ?? null
    }
    if (!contatoId && name) {
      const { data } = await supabase.from('contatos').select('id').eq('organization_id', org.id).ilike('name', name).maybeSingle()
      contatoId = data?.id ?? null
    }
    // Não achou — cria um contato novo com o que tiver disponível.
    if (!contatoId) {
      const { data: newContato, error: contatoErr } = await supabase
        .from('contatos')
        .insert({ organization_id: org.id, name: name || phone || email || 'Cliente importado', phone, email, status: 'cliente', source: 'Importação', assigned_to: user.id })
        .select('id')
        .single()
      if (contatoErr) { errors.push(`Linha ${i + 2}: erro ao criar contato — ${contatoErr.message}`); continue }
      contatoId = newContato.id
    }

    const status = row.status?.trim().toLowerCase()
    const { error } = await supabase.from('travel_sales').insert({
      organization_id: org.id,
      contato_id: contatoId,
      created_by: user.id,
      client_name: name || row.cliente_telefone || row.cliente_email,
      destination: row.destino?.trim() || null,
      departure_date: row.data_ida?.trim() ? parseDate(row.data_ida.trim()) : null,
      return_date: row.data_volta?.trim() ? parseDate(row.data_volta.trim()) : null,
      hotel_name: row.hotel?.trim() || null,
      airline: row.companhia_aerea?.trim() || null,
      operator: row.operadora?.trim() || null,
      total_cents: toCents(row.valor_total),
      commission_cents: toCents(row.comissao),
      status: status && validStatus.has(status) ? status : 'open',
      notes: row.observacoes?.trim() || null,
    })
    if (error) errors.push(`Linha ${i + 2}: ${error.message}`)
    else imported++
  }

  revalidatePath(`/app/${orgSlug}/reservas`)
  return { ok: true as const, imported, errors }
}
