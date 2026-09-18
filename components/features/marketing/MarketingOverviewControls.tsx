'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, CalendarRange, Check } from 'lucide-react'
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

/** Dropdown compacto (mesmo padrão do AccountFilter) — era uma barra de
 *  pills sempre visível; virou um botão só, liberando espaço vertical pros
 *  cards de indicador subirem. */
export function PeriodTabs() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams?.get('period') || '30d'
  const currentLabel = PERIODS.find(p => p.value === current)?.label ?? current

  function set(value: string) {
    const params = new URLSearchParams(searchParams?.toString() || '')
    params.set('period', value)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-normal">
          <CalendarRange className="w-3.5 h-3.5" />
          <span className="font-medium">{currentLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1">
        {PERIODS.map(p => (
          <button
            key={p.value}
            type="button"
            onClick={() => set(p.value)}
            className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <span className="truncate">{p.label}</span>
            {p.value === current && <Check className="w-3.5 h-3.5 shrink-0" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
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
