'use server'

/**
 * Imóveis, appointments, attendances and retornos report datasets.
 * Split out of actions/reports.ts.
 */

import {
  brl, dt, dateOnly, relName, APPT_STATUS_PT, type ReportCtx, type ReportResult,
} from './reports-shared'

export async function getImoveisReport(ctx: ReportCtx): Promise<ReportResult> {
  const { supabase, org, startISO, endISO, base } = ctx
  const { data, error } = await supabase
    .from('property_deals')
    .select('closed_at, deal_type, final_price_cents, commission_cents, status, properties(title, code), contatos(name)')
    .eq('organization_id', org.id)
    .gte('closed_at', startISO)
    .lte('closed_at', endISO)
    .order('closed_at', { ascending: false })
  if (error) return { ok: false, error: 'query_error' }

  const rows = (data || []).map((d: any) => ({
    closed_at: dt(d.closed_at as string),
    property: relName((d as any).properties) || (d as any).properties?.code || '—',
    lead: relName((d as any).contatos) || '—',
    deal_type: d.deal_type === 'locacao' ? 'Locação' : 'Venda',
    status: d.status === 'aberto' ? 'Fechado' : 'Cancelado',
    commission: brl(d.commission_cents as number),
    amount: brl(d.final_price_cents as number),
  }))
  const totalValue = (data || []).reduce((a: number, d: any) => a + ((d.final_price_cents as number) || 0), 0)
  const totalCommission = (data || []).reduce((a: number, d: any) => a + ((d.commission_cents as number) || 0), 0)

  return {
    ok: true,
    data: {
      ...base,
      columns: [
        { key: 'closed_at', label: 'Data' },
        { key: 'property', label: 'Imóvel' },
        { key: 'lead', label: 'Lead' },
        { key: 'deal_type', label: 'Tipo' },
        { key: 'status', label: 'Status' },
        { key: 'commission', label: 'Comissão', align: 'right' },
        { key: 'amount', label: 'Valor', align: 'right' },
      ],
      rows,
      totals: { property: `${rows.length} negócio(s)`, commission: brl(totalCommission), amount: brl(totalValue) },
    },
  }
}

export async function getAppointmentsReport(ctx: ReportCtx): Promise<ReportResult> {
  const { supabase, org, startISO, endISO, base } = ctx
  const { data, error } = await supabase
    .from('appointments')
    .select('start_time, end_time, status, guest_name, guest_email, guest_phone, location, event_type:event_type_id(name), lead:contato_id(name)')
    .eq('organization_id', org.id)
    .gte('start_time', startISO)
    .lte('start_time', endISO)
    .order('start_time', { ascending: false })
  if (error) return { ok: false, error: 'query_error' }

  const rows = (data || []).map((a: any) => ({
    start_time: dt(a.start_time as string),
    event_type: relName((a as any).event_type) || '—',
    guest_name: (a.guest_name as string) || relName((a as any).lead) || '—',
    guest_email: (a.guest_email as string) || '—',
    guest_phone: (a.guest_phone as string) || '—',
    location: (a.location as string) || '—',
    status: APPT_STATUS_PT[a.status as string] || (a.status as string) || '—',
  }))

  return {
    ok: true,
    data: {
      ...base,
      columns: [
        { key: 'start_time', label: 'Início' },
        { key: 'event_type', label: 'Tipo' },
        { key: 'guest_name', label: 'Convidado' },
        { key: 'guest_email', label: 'E-mail' },
        { key: 'guest_phone', label: 'Telefone' },
        { key: 'location', label: 'Local' },
        { key: 'status', label: 'Status' },
      ],
      rows,
      totals: { guest_name: `${rows.length} agendamento(s)` },
    },
  }
}

export async function getAttendancesReport(ctx: ReportCtx): Promise<ReportResult> {
  const { supabase, org, startISO, endISO, base } = ctx
  const { data, error } = await supabase
    .from('clinic_attendances')
    .select('attended_at, total_cents, discount_cents, payment_method, notes, next_return_date, contatos(name), clinic_professionals(name), event_types(name)')
    .eq('organization_id', org.id)
    .gte('attended_at', startISO)
    .lte('attended_at', endISO)
    .order('attended_at', { ascending: false })
  if (error) return { ok: false, error: 'query_error' }

  const rows = (data || []).map((a: any) => ({
    attended_at: dt(a.attended_at as string),
    patient: relName((a as any).contatos) || '—',
    professional: relName((a as any).clinic_professionals) || '—',
    service: relName((a as any).event_types) || '—',
    value: brl(Math.max(0, ((a.total_cents as number) || 0) - ((a.discount_cents as number) || 0))),
    payment_method: (a.payment_method as string) || '—',
    next_return_date: a.next_return_date ? dateOnly(a.next_return_date as string) : '—',
  }))
  const totalValue = (data || []).reduce(
    (acc: number, a: any) => acc + Math.max(0, ((a.total_cents as number) || 0) - ((a.discount_cents as number) || 0)), 0,
  )

  return {
    ok: true,
    data: {
      ...base,
      columns: [
        { key: 'attended_at', label: 'Data' },
        { key: 'patient', label: 'Paciente' },
        { key: 'professional', label: 'Profissional' },
        { key: 'service', label: 'Procedimento' },
        { key: 'value', label: 'Valor', align: 'right' },
        { key: 'payment_method', label: 'Pagamento' },
        { key: 'next_return_date', label: 'Retorno sugerido' },
      ],
      rows,
      totals: { patient: `${rows.length} atendimento(s)`, value: brl(totalValue) },
    },
  }
}

export async function getRetornosReport(ctx: ReportCtx): Promise<ReportResult> {
  const { supabase, org, from, to, base } = ctx

  // retornos — mesma fonte da tela de Retornos (clinic_attendances com
  // next_return_date preenchido); filtra pelo período do retorno sugerido,
  // não pela data do atendimento original.
  const { data, error } = await supabase
    .from('clinic_attendances')
    .select('attended_at, next_return_date, return_status, contatos(name), clinic_professionals(name), event_types(name)')
    .eq('organization_id', org.id)
    .not('next_return_date', 'is', null)
    .gte('next_return_date', from)
    .lte('next_return_date', to)
    .order('next_return_date', { ascending: true })
  if (error) return { ok: false, error: 'query_error' }

  const RETURN_STATUS_PT: Record<string, string> = {
    pendente: 'Pendente', tarefa_criada: 'Tarefa criada', agendado: 'Agendado', dispensado: 'Dispensado',
  }
  const rows = (data || []).map((a: any) => ({
    patient: relName((a as any).contatos) || '—',
    professional: relName((a as any).clinic_professionals) || '—',
    service: relName((a as any).event_types) || '—',
    attended_at: dateOnly(a.attended_at as string),
    next_return_date: dateOnly(a.next_return_date as string),
    return_status: RETURN_STATUS_PT[a.return_status as string] || (a.return_status as string) || '—',
  }))

  return {
    ok: true,
    data: {
      ...base,
      columns: [
        { key: 'patient', label: 'Paciente' },
        { key: 'professional', label: 'Profissional' },
        { key: 'service', label: 'Procedimento' },
        { key: 'attended_at', label: 'Último atendimento' },
        { key: 'next_return_date', label: 'Retorno sugerido' },
        { key: 'return_status', label: 'Status' },
      ],
      rows,
      totals: { patient: `${rows.length} retorno(s)` },
    },
  }
}
