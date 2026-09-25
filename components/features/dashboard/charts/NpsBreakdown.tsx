import { fmtPct } from '@/lib/dashboard/format'
import type { NpsResult } from '@/actions/dashboard-tabs'

/**
 * NPS sem gauge: número grande + distribuição horizontal de promotores,
 * neutros e detratores (cores de status sempre acompanhadas de rótulo).
 */
export default function NpsBreakdown({ nps }: { nps: NpsResult }) {
  const rows = [
    { label: 'Promotores', hint: 'notas 9-10', value: nps.promoters, color: 'hsl(var(--success))' },
    { label: 'Neutros', hint: 'notas 7-8', value: nps.passives, color: '#a8a8a8' },
    { label: 'Detratores', hint: 'notas 0-6', value: nps.detractors, color: 'hsl(var(--destructive))' },
  ]
  const pct = (v: number) => (nps.responses > 0 ? (v / nps.responses) * 100 : 0)
  const zone = nps.score >= 75 ? 'Excelência' : nps.score >= 50 ? 'Qualidade' : nps.score >= 0 ? 'Aperfeiçoamento' : 'Crítica'

  return (
    <div className="h-full flex flex-col justify-between gap-4">
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-muted-foreground">NPS</span>
          <span className="text-5xl font-bold tabular-nums">{nps.score}</span>
        </div>
        <div className="text-xs text-muted-foreground">Zona de {zone} · {nps.responses} resposta(s)</div>
      </div>

      <div className="flex w-full h-3 rounded-full overflow-hidden bg-muted/50">
        {rows.filter(r => r.value > 0).map(r => (
          <div key={r.label} className="h-full border-r-2 border-card last:border-r-0" style={{ width: `${pct(r.value)}%`, backgroundColor: r.color }} title={`${r.label}: ${fmtPct(pct(r.value))}`} />
        ))}
      </div>

      <div className="space-y-2.5">
        {rows.map(r => (
          <div key={r.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: r.color }} />
                <span className="font-medium">{r.label}</span>
                <span className="text-muted-foreground text-[10px]">{r.hint}</span>
              </span>
              <span className="tabular-nums font-semibold">{fmtPct(pct(r.value))} <span className="text-muted-foreground font-normal">({r.value})</span></span>
            </div>
            <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct(r.value)}%`, backgroundColor: r.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
