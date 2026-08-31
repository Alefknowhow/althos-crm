'use client'

/**
 * Barra única por anúncio, dividida em 3 estágios de cor — cada estágio é
 * uma métrica diferente. Como as 3 métricas vivem em escalas muito
 * diferentes (impressões >> cliques >> conversões), cada segmento é
 * normalizado contra o MÁXIMO da própria métrica entre os anúncios exibidos
 * (0-100), não contra um valor absoluto — a barra vira um indicador visual
 * comparativo entre anúncios, não uma soma real. O número real de cada
 * indicador aparece como badge discreto dentro/ao lado do próprio segmento
 * (ver CustomSegmentLabel), então nada de informação é perdido pra quem
 * olha com atenção.
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from 'recharts'

export type SegmentMetric = {
  key: string
  label: string
  color: string
  extract: (row: any) => number
  format: (v: number) => string
  /** Formatação curta pro badge dentro do segmento (default: notação "1.2k"). */
  formatShort?: (v: number) => string
}

/** Renderiza o valor BRUTO (não o normalizado usado pra dimensionar a barra)
 *  como um badge discreto centralizado no segmento — recharts passa x/y/
 *  width/height calculados a partir do valor normalizado, então a posição
 *  já reflete o tamanho visual do segmento; só o texto usa o dado real. */
function makeSegmentLabel(rawKey: string, formatShort: (v: number) => string) {
  return (props: any) => {
    const { x, y, width, height, payload } = props
    const raw = payload?.[rawKey]
    if (!raw || width < 20) return null
    return (
      <text
        x={x + width / 2}
        y={y + height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-white"
        style={{ fontSize: 9, fontWeight: 600 }}
      >
        {formatShort(raw)}
      </text>
    )
  }
}

function shortNumber(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace('.0', '')}k`
  return String(Math.round(v))
}

export default function AdSegmentedBarChart({
  rows,
  metrics,
  nameOf,
  campaignOf,
  emptyLabel = 'Nenhum dado no período.',
}: {
  rows: any[]
  metrics: [SegmentMetric, SegmentMetric, SegmentMetric]
  nameOf: (row: any) => string
  campaignOf?: (row: any) => string | undefined
  emptyLabel?: string
}) {
  // Ordena pelo total bruto do 1º indicador (o "principal" — conversões ou
  // valor investido, dependendo do gráfico) e pega os top 6.
  const ranked = [...rows]
    .filter(r => metrics.some(m => m.extract(r) > 0))
    .sort((a, b) => metrics[0].extract(b) - metrics[0].extract(a))
    .slice(0, 6)

  if (ranked.length === 0) {
    return (
      <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground text-center px-4">
        {emptyLabel}
      </div>
    )
  }

  const maxByMetric = metrics.map(m => Math.max(1, ...ranked.map(r => m.extract(r))))

  const data = ranked.map(r => {
    const raw: Record<string, number> = {}
    const norm: Record<string, number> = {}
    metrics.forEach((m, i) => {
      raw[m.key] = m.extract(r)
      norm[`${m.key}__norm`] = Math.round((m.extract(r) / maxByMetric[i]) * 100)
    })
    return { name: nameOf(r), campaign: campaignOf?.(r), ...raw, ...norm }
  })

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }} barCategoryGap={10}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          fontSize={11}
          tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 16)}…` : v)}
        />
        <RTooltip
          content={({ active, payload, label }) => {
            if (!active || !payload || payload.length === 0) return null
            const row = payload[0].payload
            return (
              <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
                <p className="font-medium">{label}{row.campaign ? ` · ${row.campaign}` : ''}</p>
                {metrics.map(m => (
                  <p key={m.key} className="text-muted-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: m.color }} />
                    {m.label}: {m.format(row[m.key])}
                  </p>
                ))}
              </div>
            )
          }}
        />
        {metrics.map((m, i) => (
          <Bar
            key={m.key}
            dataKey={`${m.key}__norm`}
            stackId="segments"
            fill={m.color}
            radius={i === metrics.length - 1 ? [0, 4, 4, 0] : i === 0 ? [4, 0, 0, 4] : undefined}
            label={makeSegmentLabel(m.key, m.formatShort || shortNumber)}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
