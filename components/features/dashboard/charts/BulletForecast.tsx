import { fmtCurrency0, fmtCurrencyCompact, fmtPct } from '@/lib/dashboard/format'

/**
 * Bullet chart de previsão de fechamento: trilho único com três camadas
 * progressivas (realizado → + provável → + possível) e marcador vertical da
 * meta. HTML/CSS puro (sem Recharts) — nada a hidratar.
 */
export default function BulletForecast({
  realizedCents,
  probableCents,
  possibleCents,
  goalCents,
  labels = { realized: 'Realizado', probable: 'Pipeline provável', possible: 'Pipeline possível' },
}: {
  realizedCents: number
  probableCents: number
  possibleCents: number
  goalCents: number | null
  labels?: { realized: string; probable: string; possible: string }
}) {
  const layers = [
    { key: 'realized', label: labels.realized, value: realizedCents, color: 'hsl(var(--primary))', opacity: 1 },
    { key: 'probable', label: labels.probable, value: probableCents, color: 'hsl(var(--primary))', opacity: 0.55 },
    { key: 'possible', label: labels.possible, value: possibleCents, color: 'hsl(var(--primary))', opacity: 0.22 },
  ]
  const total = realizedCents + probableCents + possibleCents
  const scaleMax = Math.max(1, total, goalCents || 0) * 1.05
  const pct = (v: number) => `${(v / scaleMax) * 100}%`
  const expected = realizedCents + probableCents
  const gap = goalCents ? goalCents - expected : null

  return (
    <div className="h-full flex flex-col justify-between gap-4">
      <div>
        <div className="text-[11px] text-muted-foreground">Fechamento esperado do mês</div>
        <div className="text-2xl font-bold tabular-nums">{fmtCurrency0(expected)}</div>
        <div className="text-[11px] text-muted-foreground">
          {goalCents ? (
            <>
              {fmtPct((expected / goalCents) * 100)} da meta ·{' '}
              {gap !== null && gap > 0 ? <span className="text-warning">faltam {fmtCurrencyCompact(gap)}</span> : <span className="text-success">meta coberta</span>}
            </>
          ) : 'Meta mensal não configurada'}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="relative h-7 rounded-md bg-muted/60 overflow-visible" role="img" aria-label="Previsão de fechamento do mês">
          <div className="absolute inset-y-0 left-0 flex rounded-md overflow-hidden w-full">
            {layers.map(l => (
              <div
                key={l.key}
                title={`${l.label}: ${fmtCurrency0(l.value)}`}
                className="h-full border-r-2 border-card last:border-r-0 hover:brightness-110 transition"
                style={{ width: pct(l.value), backgroundColor: l.color, opacity: l.opacity }}
              />
            ))}
          </div>
          {goalCents ? (
            <div className="absolute -top-1.5 -bottom-1.5 w-0.5 bg-foreground" style={{ left: pct(goalCents) }} title={`Meta: ${fmtCurrency0(goalCents)}`} />
          ) : null}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
          <span>R$ 0</span>
          <span>{fmtCurrencyCompact(scaleMax)}</span>
        </div>
      </div>

      <dl className="space-y-1.5 text-xs">
        {layers.map(l => (
          <div key={l.key} className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color, opacity: l.opacity }} />
              {l.label}
            </dt>
            <dd className="font-medium tabular-nums">{fmtCurrency0(l.value)}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-2 border-t pt-1.5">
          <dt className="flex items-center gap-2 text-muted-foreground">
            <span className="w-0.5 h-3 bg-foreground" />
            Meta
          </dt>
          <dd className="font-semibold tabular-nums">{goalCents ? fmtCurrency0(goalCents) : '—'}</dd>
        </div>
      </dl>
    </div>
  )
}
