'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'

/**
 * Vertical Clínicas — Fase 10: Dashboard/relatórios clínicos. Todas as
 * métricas vêm de dado real já existente (clinic_attendances,
 * clinic_appointment_context, clinic_commissions, clinic_waitlist) — sem
 * placeholder/mock, seguindo a mesma regra "não inventar dado" do
 * dashboard genérico.
 */

export type ClinicDashboardMetrics = {
  attendancesToday: number
  noShowRate30d: number | null
  pendingCommissionsCents: number
  pendingReturns: number
  waitlistOpen: number
  attendancesByProfessional: { label: string; value: number; valueLabel: string }[]
  revenueByService: { label: string; value: number; valueLabel: string }[]
}

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

export async function getClinicDashboardMetrics(orgSlug: string): Promise<ClinicDashboardMetrics> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: attendancesToday },
    { data: statusRows },
    { data: pendingCommissions },
    { count: pendingReturns },
    { count: waitlistOpen },
    { data: attendances30d },
  ] = await Promise.all([
    supabase
      .from('clinic_attendances')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .gte('attended_at', todayStart)
      .lt('attended_at', todayEnd),
    supabase
      .from('clinic_appointment_context')
      .select('clinic_status')
      .eq('organization_id', org.id)
      .gte('created_at', since30d)
      .in('clinic_status', ['realizado', 'no_show']),
    supabase
      .from('clinic_commissions')
      .select('commission_cents')
      .eq('organization_id', org.id)
      .eq('status', 'pendente'),
    supabase
      .from('clinic_attendances')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .eq('return_status', 'pendente'),
    supabase
      .from('clinic_waitlist')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .eq('status', 'aguardando'),
    supabase
      .from('clinic_attendances')
      .select('professional_id, event_type_id, total_cents, discount_cents, clinic_professionals(name), event_types(name)')
      .eq('organization_id', org.id)
      .gte('attended_at', since30d),
  ])

  const totalForNoShow = (statusRows || []).length
  const noShowCount = (statusRows || []).filter(r => r.clinic_status === 'no_show').length
  const noShowRate30d = totalForNoShow > 0 ? (noShowCount / totalForNoShow) * 100 : null

  const pendingCommissionsCents = (pendingCommissions || []).reduce((a, c) => a + c.commission_cents, 0)

  // Atendimentos por profissional (contagem, 30d).
  const byProf = new Map<string, number>()
  for (const a of (attendances30d || []) as any[]) {
    const name = a.clinic_professionals?.name
    if (!name) continue
    byProf.set(name, (byProf.get(name) || 0) + 1)
  }
  const attendancesByProfessional = Array.from(byProf.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([label, value]) => ({ label, value, valueLabel: `${value}` }))

  // Receita por serviço (30d) — valor efetivamente cobrado
  // (clinic_attendances.total_cents - discount_cents, editável na tela de
  // Atendimentos), não mais o preço de tabela — reflete descontos/ajustes
  // caso a caso.
  const byService = new Map<string, number>()
  for (const a of (attendances30d || []) as any[]) {
    const name = a.event_types?.name
    if (!name) continue
    const net = Math.max(0, (a.total_cents || 0) - (a.discount_cents || 0))
    byService.set(name, (byService.get(name) || 0) + net)
  }
  const revenueByService = Array.from(byService.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([label, value]) => ({ label, value, valueLabel: fmtCurrency(value) }))

  return {
    attendancesToday: attendancesToday || 0,
    noShowRate30d,
    pendingCommissionsCents,
    pendingReturns: pendingReturns || 0,
    waitlistOpen: waitlistOpen || 0,
    attendancesByProfessional,
    revenueByService,
  }
}
