'use client'

/**
 * Barra horizontal de busca + filtros do painel de Gestão de Viagens —
 * busca, Período/Destino/Status/Responsável/Operadora, "Mais filtros"
 * (Saúde da reserva) e Ordenar por. Extraída de ScheduleClient.tsx.
 */

import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Search, SlidersHorizontal, X } from 'lucide-react'

export type SchedulePeriod = 'all' | '30d' | 'month' | 'next_month'
export type ScheduleHealthFilter = 'all' | 'green' | 'yellow' | 'red'
export type ScheduleStatusFilter = 'all' | 'active' | 'cancelled'
export type ScheduleSort = 'departure' | 'return' | 'client' | 'destination' | 'tasks_pending'

export function ScheduleFiltersBar({
  search, setSearch, owner, setOwner, members,
  period, setPeriod, health, setHealth,
  destination, setDestination, destinations,
  status, setStatus, operator, setOperator, operators,
  sort, setSort,
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
  destination: string
  setDestination: (v: string) => void
  destinations: string[]
  status: ScheduleStatusFilter
  setStatus: (v: ScheduleStatusFilter) => void
  operator: string
  setOperator: (v: string) => void
  operators: string[]
  sort: ScheduleSort
  setSort: (v: ScheduleSort) => void
}) {
  const hasActiveFilters = health !== 'all'
  function clearFilters() { setHealth('all') }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[220px] max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por cliente, destino, localizador, reserva..."
          className="h-9 w-full rounded-md border border-input bg-input/25 pl-8 pr-7 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <Select value={period} onValueChange={v => setPeriod(v as SchedulePeriod)}>
        <SelectTrigger className="h-9 text-xs w-[130px] shrink-0"><SelectValue placeholder="Período" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Período</SelectItem>
          <SelectItem value="30d">Próximos 30 dias</SelectItem>
          <SelectItem value="month">Este mês</SelectItem>
          <SelectItem value="next_month">Mês que vem</SelectItem>
        </SelectContent>
      </Select>

      <Select value={destination} onValueChange={setDestination}>
        <SelectTrigger className="h-9 text-xs w-[130px] shrink-0"><SelectValue placeholder="Destino" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Destino</SelectItem>
          {destinations.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={v => setStatus(v as ScheduleStatusFilter)}>
        <SelectTrigger className="h-9 text-xs w-[110px] shrink-0"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Status</SelectItem>
          <SelectItem value="active">Ativa</SelectItem>
          <SelectItem value="cancelled">Cancelada</SelectItem>
        </SelectContent>
      </Select>

      {members.length > 0 && (
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger className="h-9 text-xs w-[140px] shrink-0"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Responsável</SelectItem>
            {members.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <Select value={operator} onValueChange={setOperator}>
        <SelectTrigger className="h-9 text-xs w-[130px] shrink-0"><SelectValue placeholder="Operadora" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Operadora</SelectItem>
          {operators.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium shrink-0 hover:bg-muted transition-colors',
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Mais filtros
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Saúde da reserva</Label>
            <Select value={health} onValueChange={v => setHealth(v as ScheduleHealthFilter)}>
              <SelectTrigger className="h-9 text-xs w-full"><SelectValue placeholder="Saúde da reserva" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Saúde: todas</SelectItem>
                <SelectItem value="green">Em dia</SelectItem>
                <SelectItem value="yellow">Atenção</SelectItem>
                <SelectItem value="red">Pendência importante</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
              Limpar filtros
            </button>
          )}
        </PopoverContent>
      </Popover>

      <div className="ml-auto flex items-center gap-1.5 shrink-0">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Ordenar por</span>
        <Select value={sort} onValueChange={v => setSort(v as ScheduleSort)}>
          <SelectTrigger className="h-9 text-xs w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="departure">Data de embarque (mais próxima)</SelectItem>
            <SelectItem value="return">Data de retorno</SelectItem>
            <SelectItem value="client">Cliente</SelectItem>
            <SelectItem value="destination">Destino</SelectItem>
            <SelectItem value="tasks_pending">Nº de tarefas pendentes</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
