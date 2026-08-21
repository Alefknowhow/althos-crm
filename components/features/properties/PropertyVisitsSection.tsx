'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CalendarClock, Plus, Loader2, X, Check, UserX } from 'lucide-react'
import { scheduleVisit, updateVisitStatus, type PropertyVisitRow, type PropertyVisitStatus } from '@/actions/property-visits'

type Mode = { type: 'contato'; contatoId: string } | { type: 'property'; propertyId: string }
type PropertyOption = { id: string; title: string; code: string | null }
type ContatoOption = { id: string; name: string }
type Member = { user_id: string; name: string }

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

export default function PropertyVisitsSection({
  orgSlug, mode, initial, properties = [], contatos = [], members = [],
}: {
  orgSlug: string
  mode: Mode
  initial: PropertyVisitRow[]
  properties?: PropertyOption[]
  contatos?: ContatoOption[]
  members?: Member[]
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [brokerId, setBrokerId] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleSchedule() {
    if (!selectedId || !scheduledAt) { toast.error('Escolha o imóvel/lead e a data.'); return }
    setSaving(true)
    const input = mode.type === 'contato'
      ? { propertyId: selectedId, contatoId: mode.contatoId, brokerUserId: brokerId || null, scheduledAt: new Date(scheduledAt).toISOString() }
      : { propertyId: mode.propertyId, contatoId: selectedId, brokerUserId: brokerId || null, scheduledAt: new Date(scheduledAt).toISOString() }
    const res = await scheduleVisit(orgSlug, input)
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Visita agendada')
    setAdding(false); setSelectedId(''); setBrokerId(''); setScheduledAt('')
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="w-4 h-4" /> Visitas
        </CardTitle>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 mr-1" /> Agendar visita
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger><SelectValue placeholder={mode.type === 'contato' ? 'Escolher imóvel…' : 'Escolher lead…'} /></SelectTrigger>
              <SelectContent>
                {mode.type === 'contato'
                  ? properties.map(p => <SelectItem key={p.id} value={p.id}>{p.title || p.code || 'Imóvel'}</SelectItem>)
                  : contatos.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input type="datetime-local" className="flex-1" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
              <Select value={brokerId || 'none'} onValueChange={v => setBrokerId(v === 'none' ? '' : v)}>
                <SelectTrigger className="w-[180px] shrink-0"><SelectValue placeholder="Corretor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem corretor</SelectItem>
                  {members.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSchedule} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Agendar
              </Button>
            </div>
          </div>
        )}

        {initial.length === 0 && !adding ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma visita agendada ainda.</p>
        ) : (
          <div className="space-y-2">
            {initial.map(v => (
              <div key={v.id} className="border rounded-md p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    {mode.type === 'contato' ? (
                      <Link href={`/app/${orgSlug}/imoveis/${v.property_id}`} className="text-sm font-medium truncate hover:underline">
                        {v.property_title || v.property_code || 'Imóvel'}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium truncate">{v.contato_name || 'Contato'}</span>
                    )}
                    <p className="text-xs text-muted-foreground">{fmt(v.scheduled_at)}</p>
                  </div>
                  <Badge className={STATUS_COLORS[v.status]} variant="secondary">{STATUS_LABELS[v.status]}</Badge>
                </div>
                {v.canceled_reason && <p className="text-xs text-muted-foreground">Motivo: {v.canceled_reason}</p>}
                {(v.status === 'agendada' || v.status === 'confirmada') && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {v.status === 'agendada' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busyId === v.id} onClick={() => handleStatus(v.id, 'confirmada')}>
                        <Check className="w-3 h-3 mr-1" /> Confirmar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busyId === v.id} onClick={() => handleStatus(v.id, 'realizada')}>
                      <Check className="w-3 h-3 mr-1" /> Realizada
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busyId === v.id} onClick={() => handleStatus(v.id, 'nao_compareceu')}>
                      <UserX className="w-3 h-3 mr-1" /> Não compareceu
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" disabled={busyId === v.id} onClick={() => handleStatus(v.id, 'cancelada')}>
                      <X className="w-3 h-3 mr-1" /> Cancelar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
