import { fmtPct } from '@/lib/dashboard/format'

/**
 * Heatmap de conversão entre estágios: linha = estágio de origem, coluna =
 * estágio de destino; célula = % das oportunidades que chegaram à origem e
 * também chegaram ao destino (só metade superior, j > i). Cor sequencial de
 * um único tom (primary), mais escuro = maior conversão. A diagonal logo
 * acima da principal é a conversão estágio→próximo estágio.
 */
export default function ConversionHeatmap({ stages }: { stages: { name: string; reached: number }[] }) {
  if (stages.length < 2) return null
  const cols = stages.slice(1)
  const rows = stages.slice(0, -1)
  return (
    <div className="overflow-auto h-full">
      <table className="w-full border-separate" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th className="text-[10px] font-medium text-muted-foreground text-left pr-1 align-bottom">de ↓ / para →</th>
            {cols.map(c => (
              <th key={c.name} className="text-[10px] font-medium text-muted-foreground px-1 pb-1 max-w-[80px] truncate" title={c.name}>{c.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name}>
              <th className="text-[11px] font-medium text-left pr-2 whitespace-nowrap max-w-[110px] truncate" title={r.name}>{r.name}</th>
              {cols.map((c, jj) => {
                const j = jj + 1
                if (j <= i) return <td key={c.name} />
                const pct = r.reached > 0 ? (stages[j].reached / r.reached) * 100 : null
                const intensity = pct === null ? 0 : Math.min(1, pct / 100)
                const isNext = j === i + 1
                return (
                  <td
                    key={c.name}
                    title={`${r.name} → ${c.name}: ${fmtPct(pct)} (${stages[j].reached} de ${r.reached})`}
                    className={`h-9 min-w-[48px] rounded text-center text-[11px] tabular-nums font-medium cursor-default transition hover:ring-2 hover:ring-ring ${isNext ? 'ring-1 ring-foreground/30' : ''}`}
                    style={{
                      backgroundColor: pct === null ? 'hsl(var(--muted) / 0.4)' : `hsl(var(--primary) / ${0.08 + intensity * 0.82})`,
                      color: intensity > 0.5 ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                    }}
                  >
                    {fmtPct(pct)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>0%</span>
        <span className="h-2 w-24 rounded-sm" style={{ background: 'linear-gradient(to right, hsl(var(--primary) / .08), hsl(var(--primary) / .9))' }} />
        <span>100%</span>
        <span className="ml-auto">Borda = conversão para o estágio seguinte</span>
      </div>
    </div>
  )
}
