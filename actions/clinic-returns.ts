'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

/**
 * Vertical Clínicas — Fase 9: Retornos. Reaproveita
 * clinic_attendances.next_return_date (Fase 5) — não é uma entidade nova,
 * só um painel sobre atendimentos com retorno sugerido + ações (criar
 * tarefa no Core, marcar agendado, dispensar). Ver
 * supabase/migrations/0171_clinic_returns.sql.
 */

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'atendimentos_clinica')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

export type ClinicReturnRow = {
  attendance_id: string
  patient_contato_id: string
  patient_name: string
  professional_name: string | null
  service_name: string | null
  attended_at: string
  next_return_date: string
  return_status: 'pendente' | 'tarefa_criada' | 'agendado' | 'dispensado'
  return_task_id: string | null
}

export async function listClinicReturns(orgSlug: string): Promise<ClinicReturnRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_attendances')
    .select('id, patient_contato_id, attended_at, next_return_date, return_status, return_task_id, contatos(name), clinic_professionals(name), event_types(name)')
    .eq('organization_id', org.id)
    .not('next_return_date', 'is', null)
    .order('next_return_date', { ascending: true })
    .limit(200)

  return (data || []).map((r: any) => ({
    attendance_id: r.id,
    patient_contato_id: r.patient_contato_id,
    patient_name: r.contatos?.name || 'Contato removido',
    professional_name: r.clinic_professionals?.name || null,
    service_name: r.event_types?.name || null,
    attended_at: r.attended_at,
    next_return_date: r.next_return_date,
    return_status: r.return_status,
    return_task_id: r.return_task_id,
  }))
}

/** Cria uma tarefa (Core, /tarefas) com vencimento na data de retorno
 *  sugerida e vincula o paciente — mesma tabela/fluxo usado pelo resto do
 *  CRM, sem sistema de tarefas paralelo pra clínica. */
export async function createClinicReturnTask(orgSlug: string, attendanceId: string) {
  const { org, user } = await requireAccess(orgSlug)
  const supabase = createClient()

  const { data: att } = await supabase
    .from('clinic_attendances')
    .select('patient_contato_id, next_return_date, contatos(name), event_types(name)')
    .eq('id', attendanceId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!att) return { ok: false as const, error: 'Atendimento não encontrado.' }

  const { data: column } = await supabase
    .from('task_columns')
    .select('id')
    .eq('organization_id', org.id)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()

  const patientName = (att as any).contatos?.name || 'paciente'
  const serviceName = (att as any).event_types?.name
  const title = `Retorno: ${patientName}${serviceName ? ` — ${serviceName}` : ''}`

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      organization_id: org.id,
      contato_id: att.patient_contato_id,
      title,
      due_date: att.next_return_date,
      priority: 'normal',
      status: 'open',
      assigned_to: user.id,
      column_id: column?.id ?? null,
    })
    .select('id')
    .maybeSingle()
  if (error || !task) return { ok: false as const, error: error?.message || 'Erro ao criar tarefa' }

  await supabase
    .from('clinic_attendances')
    .update({ return_status: 'tarefa_criada', return_task_id: task.id })
    .eq('id', attendanceId)
    .eq('organization_id', org.id)

  revalidatePath(`/app/${orgSlug}/retornos`)
  revalidatePath(`/app/${orgSlug}/tarefas`)
  return { ok: true as const }
}

export async function setClinicReturnStatus(
  orgSlug: string,
  attendanceId: string,
  status: 'pendente' | 'agendado' | 'dispensado',
) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase
    .from('clinic_attendances')
    .update({ return_status: status })
    .eq('id', attendanceId)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/retornos`)
  return { ok: true as const }
}
