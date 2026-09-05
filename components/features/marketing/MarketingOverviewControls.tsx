'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { PERIODS } from './MarketingOverviewShared'

/** Um número atual x anterior, com % de variação — sem julgar se subir é bom
 *  ou ruim (depende da métrica: investimento subir não é "ruim"), só mostra
 *  a direção e o tamanho da mudança. */
export function ComparisonStat({
  label, current, previous, format, invertColor = false,
}: {
  label: string
  current: number
  previous: number
  format: (v: number) => string
  /** true pra métricas de CUSTO (CPC, custo por conversa, CPM, custo por
   *  conversão) — subir é ruim (vermelho), descer é bom (verde). Sem isso,
   *  toda métrica tratava "subir" como positivo (verde), o que faz sentido
   *  pra investimento/conversões mas é o oposto do esperado pra custo. */
  invertColor?: boolean
}) {
  const delta = previous > 0 ? ((current - previous) / previous) * 100 : null
  const isGood = delta == null ? null : invertColor ? delta < 0 : delta >= 0
  return (
    <div className="rounded-lg border p-3 space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-base font-bold tabular-nums">{format(current)}</p>
      {delta != null ? (
        <p className={cn('text-xs tabular-nums flex items-center gap-1', isGood ? 'text-emerald-600' : 'text-red-600')}>
          {delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
          <span className="text-muted-foreground">vs {format(previous)}</span>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Sem dado anterior</p>
      )}
    </div>
  )
}

export function PeriodTabs() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams?.get('period') || '30d'

  function set(value: string) {
    const params = new URLSearchParams(searchParams?.toString() || '')
    params.set('period', value)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={current} onValueChange={set}>
      <TabsList className="bg-secondary rounded-full p-1 h-auto gap-0.5">
        {PERIODS.map(p => (
          <TabsTrigger
            key={p.value}
            value={p.value}
            className="rounded-full px-3.5 py-1.5 text-xs font-medium data-[state=active]:bg-background  "
          >
            {p.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

export function KPICard({
  label,
  value,
  sublabel,
  icon: Icon,
  iconBg,
}: {
  label: string
  value: string
  sublabel?: string
  icon: any
  iconBg?: string
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconBg || 'bg-muted text-muted-foreground'}`}
          >
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium truncate">{label}</p>
            <p className="text-lg font-bold tabular-nums mt-0.5 truncate">{value}</p>
            {sublabel && (
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sublabel}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
