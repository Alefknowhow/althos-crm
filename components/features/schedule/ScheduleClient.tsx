'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { getTripTasks, type ScheduledTrip, type TripTask } from '@/actions/travel-schedule'
import { listSaleProducts, type SaleProduct } from '@/actions/sale-products'
import { CalendarClock, CalendarDays, ListChecks } from 'lucide-react'
import { type TripState } from './ScheduleGanttView'
import { TripDetail } from './ScheduleTripDetail'
import { ScheduleListView } from './ScheduleListView'
import { ScheduleTimelineListView } from './ScheduleTimelineListView'
import { ScheduleFiltersBar, type SchedulePeriod, type ScheduleHealthFilter } from './ScheduleFiltersBar'

const DAY = 86400000

function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }
function addDays(d: Date, n: number) { return new Date(d.getTime() + n * DAY) }

function tripState(t: ScheduledTrip, today: Date): TripState {
  const dep = parseDate(t.departure_date)
  const ret = parseDate(t.return_date) || dep
  if (!dep) return 'upcoming'
  const end = ret || dep
  if (end < today) return 'past'
  if (dep <= today && today <= end) return 'ongoing'
  return 'upcoming'
}

export default function ScheduleClient({
  orgSlug, trips, members = [],
}: {
  orgSlug: string
  trips: ScheduledTrip[]
  members?: { user_id: string; name: string }[]
}) {
  const today = useMemo(() => startOfDay(new Date()), [])
  const [filter, setFilter] = useState<'all' | TripState>('all')
  const [owner, setOwner] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState<SchedulePeriod>('all')
  const [health, setHealth] = useState<ScheduleHealthFilter>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selected, setSelected] = useState<ScheduledTrip | null>(null)
  const [tasks, setTasks] = useState<TripTask[]>([])
  const [loadingTasks, startTasks] = useTransition()
  const [products, setProducts] = useState<SaleProduct[]>([])
  const [loadingProducts, startProducts] = useTransition()

  const filtered = useMemo(() => {
    let out = trips
    if (filter !== 'all') out = out.filter(t => tripState(t, today) === filter)
    if (owner !== 'all') out = out.filter(t => t.created_by === owner)
    if (health !== 'all') out = out.filter(t => t.health === health)
    if (period !== 'all') {
      out = out.filter(t => {
        const dep = parseDate(t.departure_date)
        if (!dep) return false
        if (period === '30d') return dep >= today && dep <= addDays(today, 30)
        const monthOffset = period === 'month' ? 0 : 1
        const target = addMonths(today, monthOffset)
        return dep.getFullYear() === target.getFullYear() && dep.getMonth() === target.getMonth()
      })
    }
    const needle = search.trim().toLowerCase()
    if (needle) {
      out = out.filter(t =>
        (t.client_name || '').toLowerCase().includes(needle) ||
        (t.destination || '').toLowerCase().includes(needle) ||
        (t.package_locator || '').toLowerCase().includes(needle) ||
        (t.air_locator || '').toLowerCase().includes(needle),
      )
    }
    return out
  }, [trips, filter, owner, health, period, search, today])

  function openTrip(t: ScheduledTrip) {
    setSelected(t)
    setTasks([])
    setProducts([])
    if (t.contato_id) {
      startTasks(async () => {
        const res = await getTripTasks(orgSlug, t.contato_id!)
        setTasks(res)
      })
    }
    startProducts(async () => {
      const res = await listSaleProducts(orgSlug, t.id)
      setProducts(res)
    })
  }

  const counts = useMemo(() => {
    const c = { all: trips.length, upcoming: 0, ongoing: 0, past: 0 }
    for (const t of trips) c[tripState(t, today)]++
    return c
  }, [trips, today])

  if (trips.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Nenhum embarque programado"
        description="As viagens vendidas com data de partida aparecem aqui em um painel visual. Registre uma reserva em Reservas para começar."
      >
        <Button className="mt-4" asChild>
          <Link href={`/app/${orgSlug}/reservas`}>Ir para Reservas</Link>
        </Button>
      </EmptyState>
    )
  }

  return (
    <>
      <Tabs defaultValue="list">
        <ScheduleFiltersBar
          search={search} setSearch={setSearch}
          owner={owner} setOwner={setOwner} members={members}
          period={period} setPeriod={setPeriod}
          health={health} setHealth={setHealth}
          filtersOpen={filtersOpen} setFiltersOpen={setFiltersOpen}
        />

        {/* Status (Todas/Próximas/Em andamento/Concluídas) + Lista/Linha do tempo — mesma linha, sempre nessa posição. */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {([
              { id: 'all', label: `Todas (${counts.all})` },
              { id: 'upcoming', label: `Próximas (${counts.upcoming})` },
              { id: 'ongoing', label: `Em andamento (${counts.ongoing})` },
              { id: 'past', label: `Concluídas (${counts.past})` },
            ] as const).map(b => (
              <button
                key={b.id}
                onClick={() => setFilter(b.id)}
                className={cn(
                  'px-3 h-8 rounded-full border text-xs font-medium transition-colors',
                  filter === b.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-muted-foreground border-border',
                )}
              >
                {b.label}
              </button>
            ))}
          </div>

          <TabsList>
            <TabsTrigger value="list"><ListChecks className="w-4 h-4 mr-1.5" /> Lista</TabsTrigger>
            <TabsTrigger value="gantt"><CalendarDays className="w-4 h-4 mr-1.5" /> Linha do tempo</TabsTrigger>
          </TabsList>
        </div>

        {/* ── Linha do tempo (anexo 3) ─────────────────────────── */}
        <TabsContent value="gantt" className="mt-4">
          <ScheduleTimelineListView
            filtered={filtered}
            today={today}
            tripState={tripState}
            onOpenTrip={openTrip}
          />
        </TabsContent>

        {/* ── Lista ───────────────────────────────────────────── */}
        <TabsContent value="list" className="mt-4">
          <ScheduleListView
            orgSlug={orgSlug}
            filtered={filtered}
            today={today}
            tripState={tripState}
            members={members}
            onOpenTrip={openTrip}
          />
        </TabsContent>
      </Tabs>

      {/* ── Detalhe ──────────────────────────────────────────── */}
      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <TripDetail
              orgSlug={orgSlug}
              trip={selected}
              tasks={tasks}
              loadingTasks={loadingTasks}
              products={products}
              loadingProducts={loadingProducts}
              state={tripState(selected, today)}
              today={today}
              sellerName={members.find(m => m.user_id === selected.created_by)?.name}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
