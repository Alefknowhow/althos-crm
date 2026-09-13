'use client'

/**
 * Linha de busca + Responsável + Período + Filtros do painel de Embarques
 * — extraída de ScheduleClient.tsx só pra manter o arquivo dentro do
 * limite de linhas do lint.
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { Search, X, SlidersHorizontal } from 'lucide-react'

export type SchedulePeriod = 'all' | '30d' | 'month' | 'next_month'
export type ScheduleHealthFilter = 'all' | 'green' | 'yellow' | 'red'

export function ScheduleFiltersBar({
  search, setSearch, owner, setOwner, members,
  period, setPeriod, health, setHealth, filtersOpen, setFiltersOpen,
}: {
  search: string
  setSearch: (v: string) => void
  owner: string
  setOwner: (v: string) => void
  members: { user_id: string; name: string }[]
  period: SchedulePeriod
  setPeriod: (v: SchedulePeriod) => void
  health: ScheduleHealthFilter
  setHealth: (v: ScheduleHealthFilter) => void
  filtersOpen: boolean
  setFiltersOpen: (v: boolean) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-2">
      <div className="relative flex-1 min-w-[220px] max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar viagem, destino ou localizador..."
          className="h-9 w-full rounded-md border border-input bg-input/25 pl-8 pr-7 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {members.length > 0 && (
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger className="h-9 w-[170px] text-xs"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos responsáveis</SelectItem>
            {members.map(m => (
              <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={period} onValueChange={v => setPeriod(v as SchedulePeriod)}>
        <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue placeholder="Período" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todo período</SelectItem>
          <SelectItem value="30d">Próximos 30 dias</SelectItem>
          <SelectItem value="month">Este mês</SelectItem>
          <SelectItem value="next_month">Mês que vem</SelectItem>
        </SelectContent>
      </Select>

      <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1.5 px-3 h-9 rounded-md border text-xs font-medium transition-colors',
              'bg-background hover:bg-muted text-muted-foreground border-border',
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Filtros
            {health !== 'all' && <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">1</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Saúde da reserva</p>
          <Select value={health} onValueChange={v => setHealth(v as ScheduleHealthFilter)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="green">Em dia</SelectItem>
              <SelectItem value="yellow">Atenção</SelectItem>
              <SelectItem value="red">Pendência importante</SelectItem>
            </SelectContent>
          </Select>
        </PopoverContent>
      </Popover>
    </div>
  )
}
