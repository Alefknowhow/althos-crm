'use client'

/**
 * Cabeçalho do painel de Gestão de Viagens — título/subtítulo, indicadores
 * compactos (viagens ativas/embarcam em 7 dias/em viagem/com alertas) e o
 * botão "+ Nova viagem". Extraído de ScheduleClient.tsx.
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'

export type ScheduleHeaderStats = { ativas: number; embarking7d: number; emViagem: number; alerts: number }

export function ScheduleHeader({ orgSlug, stats }: { orgSlug: string; stats: ScheduleHeaderStats }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestão de Viagens</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Acompanhe e gerencie todas as viagens da sua agência</p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <HeaderStat value={stats.ativas} label="viagens ativas" color="text-foreground" />
          <HeaderStat value={stats.embarking7d} label="embarcam em 7 dias" color="text-indigo-600 dark:text-indigo-400" />
          <HeaderStat value={stats.emViagem} label="em viagem" color="text-emerald-600 dark:text-emerald-400" />
          <HeaderStat value={stats.alerts} label="com alertas" color="text-red-600 dark:text-red-400" />
        </div>
        <Button size="sm" asChild>
          <Link href={`/app/${orgSlug}/reservas?novo=1`}>
            <Plus className="w-4 h-4 mr-1.5" /> Nova viagem
          </Link>
        </Button>
      </div>
    </div>
  )
}

function HeaderStat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="text-center leading-tight">
      <p className={cn('text-lg font-bold tabular-nums', color)}>{value}</p>
      <p className="text-[10px] text-muted-foreground whitespace-nowrap">{label}</p>
    </div>
  )
}
