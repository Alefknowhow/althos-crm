'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Loader2, Check, X, UserX } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { scheduleVisit, updateVisitStatus, type PropertyVisitRow, type PropertyVisitStatus } from '@/actions/property-visits'

type PropertyOption = { id: string; title: string; code: string | null }
type ContatoOption = { id: string; name: string }
type Member = { id: string; name: string }

const STATUS_LABELS: Record<PropertyVisitStatus, string> = {
  agendada: 'Agendada', confirmada: 'Confirmada', realizada: 'Realizada', cancelada: 'Cancelada', nao_compareceu: 'Não compareceu',
}
const STATUS_COLORS: Record<PropertyVisitStatus, string> = {
  agendada: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  confirmada: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  realizada: 'bg-violet-100 text-violet-700 hover:bg-violet-100',
  cancelada: 'bg-muted text-muted-foreground hover:bg-muted',
  nao_compareceu: 'bg-red-100 text-red-700 hover:bg-red-100',
}

function fmt(dt: string) {
  return new Date(dt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function todayRange() {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const end = new Date(); end.setHours(23, 59, 59, 999)
  return { from: start.toISOString(), to: end.toISOString() }
}

function weekRange() {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(end.getDate() + 7)
  return { from: start.toISOString(), to: end.toISOString() }
}

export default function VisitsView({
  orgSlug, visits, properties, contatos, members,
}: {
  orgSlug: string
  visits: PropertyVisitRow[]
  properties: PropertyOption[]
  contatos: ContatoOption[]
  members: Member[]
}) {
  const router = useRouter()
  const [brokerFilter, setBrokerFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | 'week'>('all')
  const [open, setOpen] = useState(false)
  const [propertyId, setPropertyId] = useState('')
  const [contatoId, setContatoId] = useState('')
  const [brokerId, setBrokerId] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const memberName = useMemo(() => new Map(members.map(m => [m.id, m.name])), [members])

  const filtered = useMemo(() => {
    let rows = visits
    if (brokerFilter !== 'all') rows = rows.filter(v => v.broker_user_id === brokerFilter)
    if (statusFilter !== 'all') rows = rows.filter(v => v.status === statusFilter)
    if (periodFilter === 'today') {
      const { from, to } = todayRange()
      rows = rows.filter(v => v.scheduled_at >= from && v.scheduled_at <= to)
    } else if (periodFilter === 'week') {
      const { from, to } = weekRange()
      rows = rows.filter(v => v.scheduled_at >= from && v.scheduled_at <= to)
    }
    return rows
  }, [visits, brokerFilter, statusFilter, periodFilter])

  function resetForm() {
    setPropertyId(''); setContatoId(''); setBrokerId(''); setScheduledAt('')
  }

  async function handleSchedule() {
    if (!propertyId || !contatoId || !scheduledAt) { toast.error('Escolha o imóvel, o lead e a data.'); return }
    setSaving(true)
    const res = await scheduleVisit(orgSlug, {
      propertyId, contatoId, brokerUserId: brokerId || null, scheduledAt: new Date(scheduledAt).toISOString(),
    })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Visita agendada')
    setOpen(false); resetForm()
    router.refresh()
  }

  async function handleStatus(id: string, status: PropertyVisitStatus) {
    if (status === 'cancelada') {
      const reason = window.prompt('Motivo do cancelamento (opcional):') || undefined
      setBusyId(id)
      const res = await updateVisitStatus(orgSlug, id, status, { canceledReason: reason })
      setBusyId(null)
      if (!res.ok) { toast.error(res.error); return }
      router.refresh()
      return
    }
    setBusyId(id)
    const res = await updateVisitStatus(orgSlug, id, status)
    setBusyId(null)
    if (!res.ok) { toast.error(res.error); return }
    router.refresh()
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader
        title="Visitas"
        hint="Agenda de visitas a imóveis, por corretor e período."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Nova visita
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={periodFilter} onValueChange={v => setPeriodFilter(v as any)}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as datas</SelectItem>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
          </SelectContent>
        </Select>
        <Select value={brokerFilter} onValueChange={setBrokerFilter}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Corretor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os corretores</SelectItem>
            {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Imóvel</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Corretor</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Nenhuma visita encontrada.</TableCell></TableRow>
            )}
            {filtered.map(v => (
              <TableRow key={v.id}>
                <TableCell>
                  <Link href={`/app/${orgSlug}/imoveis/${v.property_id}`} className="text-sm hover:underline">
                    {v.property_title || v.property_code || 'Imóvel'}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{v.contato_name || '—'}</TableCell>
                <TableCell className="text-sm">{(v.broker_user_id && memberName.get(v.broker_user_id)) || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmt(v.scheduled_at)}</TableCell>
                <TableCell>
                  <Badge className={STATUS_COLORS[v.status]} variant="secondary">{STATUS_LABELS[v.status]}</Badge>
                </TableCell>
                <TableCell>
                  {(v.status === 'agendada' || v.status === 'confirmada') && (
                    <div className="flex flex-wrap gap-1 justify-end">
                      {v.status === 'agendada' && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Confirmar" disabled={busyId === v.id} onClick={() => handleStatus(v.id, 'confirmada')}>
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Marcar realizada" disabled={busyId === v.id} onClick={() => handleStatus(v.id, 'realizada')}>
                        <Check className="w-3.5 h-3.5 text-violet-600" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Não compareceu" disabled={busyId === v.id} onClick={() => handleStatus(v.id, 'nao_compareceu')}>
                        <UserX className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Cancelar" disabled={busyId === v.id} onClick={() => handleStatus(v.id, 'cancelada')}>
                        <X className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetForm() }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova visita</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Imóvel</label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger><SelectValue placeholder="Escolher imóvel…" /></SelectTrigger>
                <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.title || p.code || 'Imóvel'}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Lead</label>
              <Select value={contatoId} onValueChange={setContatoId}>
                <SelectTrigger><SelectValue placeholder="Escolher lead…" /></SelectTrigger>
                <SelectContent>{contatos.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Data e hora</label>
                <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Corretor</label>
                <Select value={brokerId || 'none'} onValueChange={v => setBrokerId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Sem corretor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem corretor</SelectItem>
                    {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSchedule} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
