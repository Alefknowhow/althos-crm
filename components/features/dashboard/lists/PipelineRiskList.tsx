import { ChevronRight } from 'lucide-react'
import type { OpenDeal } from '@/actions/dashboard-v2-pipeline'
import { fmtCurrency0, fmtPct } from '@/lib/dashboard/format'
import RiskBadge from './RiskBadge'

/**
 * Lista de oportunidades em risco (não é gráfico). Visual "clicável"
 * (hover + seta) — navegação real para a oportunidade é fase 2, por isso
 * não há href/onClick aqui.
 */
export default function PipelineRiskList({ deals, nameById }: { deals: OpenDeal[]; nameById: Record<string, string> }) {
  if (deals.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma oportunidade parada. Pipeline saudável.</p>
  }
  return (
    <ul className="divide-y">
      {deals.map(d => (
        <li key={d.id} className="group flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{d.name}</span>
              <RiskBadge risk={d.risk} />
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {d.stage_name} · {d.assigned_to ? nameById[d.assigned_to] || 'Usuário' : 'Sem responsável'} · prob. {fmtPct(d.probability * 100)}
            </div>
            <div className="text-[11px] text-muted-foreground/90 truncate">{d.risk_reason}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-semibold tabular-nums">{fmtCurrency0(d.value_cents)}</div>
            <div className="text-[11px] text-muted-foreground tabular-nums">{d.idle_days}d sem interação</div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" />
        </li>
      ))}
    </ul>
  )
}
