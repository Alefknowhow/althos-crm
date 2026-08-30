import { Suspense } from 'react'
import { getClinicDashboardMetrics } from '@/actions/dashboard-clinic'
import KpiCard from '../KpiCard'
import BarListCard from '../BarListCard'
import InsightCard from '../InsightCard'
import MockInsightCard from '../mocks/MockInsightCard'
import { Stethoscope, Percent } from 'lucide-react'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

/** Aba "Clínica" — só renderizada quando o nicho da org é Clínicas (ver
 *  isModuleEnabled/isClinicNiche no page.tsx). Todas as métricas vêm de
 *  dado real (clinic_attendances/clinic_appointment_context/
 *  clinic_commissions/clinic_waitlist) — sem placeholder. */
export default async function ClinicaTab({ orgSlug }: { orgSlug: string }) {
  const m = await getClinicDashboardMetrics(orgSlug)
  const topProfessional = m.attendancesByProfessional[0]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        <KpiCard
          label="Atendimentos hoje"
          value={`${m.attendancesToday}`}
          help="Total de atendimentos registrados na data de hoje."
        />
        <KpiCard
          label="Profissional destaque (30d)"
          value={topProfessional?.label || '—'}
          trendLabel={topProfessional ? `${topProfessional.valueLabel} atendimento(s)` : undefined}
          help="Profissional com mais atendimentos registrados nos últimos 30 dias."
        />
        <KpiCard
          label="Taxa de no-show (30d)"
          value={m.noShowRate30d === null ? '—' : `${m.noShowRate30d.toFixed(1)}%`}
          help="Percentual de agendamentos marcados como 'não compareceu' nos últimos 30 dias, sobre o total de realizados + no-show."
        />
        <KpiCard
          label="Comissões pendentes"
          value={fmtCurrency(m.pendingCommissionsCents)}
          help="Soma das comissões calculadas ainda não marcadas como pagas."
        />
        <KpiCard
          label="Retornos pendentes"
          value={`${m.pendingReturns}`}
          help="Atendimentos com retorno sugerido ainda sem novo agendamento criado."
        />
        <KpiCard
          label="Lista de espera"
          value={`${m.waitlistOpen}`}
          help="Pacientes aguardando vaga (status 'aguardando')."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BarListCard
          title="Atendimentos por profissional (30d)"
          help="Contagem de atendimentos registrados nos últimos 30 dias, por profissional."
          icon={Stethoscope}
          rows={m.attendancesByProfessional}
          color="#0ea5e9"
        />
        <BarListCard
          title="Receita por serviço (30d)"
          help="Valor cobrado (clinic_attendances.total_cents, editável na tela de Atendimentos) × número de atendimentos nos últimos 30 dias."
          icon={Percent}
          rows={m.revenueByService}
          color="#10b981"
        />
      </div>

      <Suspense fallback={<MockInsightCard text="Carregando insight..." />}>
        <InsightCard orgSlug={orgSlug} tab="clinica" />
      </Suspense>
    </div>
  )
}
