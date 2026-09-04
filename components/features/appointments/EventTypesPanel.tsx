'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Copy, Trash2, Pencil, Calendar } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  createEventType,
  updateEventType,
  toggleEventTypeActive,
  deleteEventType,
} from '@/actions/appointments'
import { upsertClinicServiceContext, type ClinicServiceContext } from '@/actions/clinic'
import { EventTypesPanelDialog } from './EventTypesPanelDialog'

type EventType = {
  id: string
  name: string
  slug: string
  description: string | null
  duration_minutes: number
  color: string | null
  location: string | null
  is_active: boolean
  buffer_before_minutes: number
  buffer_after_minutes: number
  pipeline_id: string | null
  stage_id: string | null
}

type Pipeline = { id: string; name: string }
type Stage = { id: string; name: string; pipeline_id: string }
type ClinicOption = { id: string; name: string }

type Props = {
  orgSlug: string
  eventTypes: EventType[]
  pipelines: Pipeline[]
  stages: Stage[]
  isClinic?: boolean
  clinicSpecialties?: ClinicOption[]
  clinicRooms?: ClinicOption[]
  clinicProfessionals?: ClinicOption[]
  clinicServiceContexts?: Record<string, ClinicServiceContext>
  clinicSupplies?: ClinicOption[]
}

const DEFAULT_DRAFT = {
  name: '',
  duration_minutes: 30,
  description: '',
  location: '',
  color: '#3b82f6',
  buffer_before_minutes: 0,
  buffer_after_minutes: 0,
  pipeline_id: '',
  stage_id: '',
  specialty_id: '',
  room_id: '',
  professional_id: '',
  price: '',
  discount: '',
}

export default function EventTypesPanel({
  orgSlug, eventTypes, pipelines, stages,
  isClinic = false, clinicSpecialties = [], clinicRooms = [], clinicProfessionals = [], clinicServiceContexts = {},
  clinicSupplies = [],
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState(DEFAULT_DRAFT)
  const [saving, setSaving] = useState(false)
  const [etToDelete, setEtToDelete] = useState<EventType | null>(null)

  // Clínicas usa "Procedimento" no lugar do genérico "Tipo de evento" — o
  // conceito é o mesmo (event_types), só o rótulo muda pra ficar coerente
  // com o vocabulário da vertical.
  const label = isClinic ? 'Procedimento' : 'Tipo de evento'
  const labelLower = label.toLowerCase()

  function refresh() {
    startTransition(() => router.refresh())
  }

  function openNew() {
    setEditingId(null)
    setDraft(DEFAULT_DRAFT)
    setDialogOpen(true)
  }

  function openEdit(et: EventType) {
    setEditingId(et.id)
    const ctx = clinicServiceContexts[et.id]
    setDraft({
      name: et.name,
      duration_minutes: et.duration_minutes,
      description: et.description || '',
      location: et.location || '',
      color: et.color || '#3b82f6',
      buffer_before_minutes: et.buffer_before_minutes,
      buffer_after_minutes: et.buffer_after_minutes,
      pipeline_id: et.pipeline_id || '',
      stage_id: et.stage_id || '',
      specialty_id: ctx?.specialty_id || '',
      room_id: ctx?.room_id || '',
      professional_id: ctx?.professional_id || '',
      price: ctx?.price_cents ? String(ctx.price_cents / 100) : '',
      discount: ctx?.default_discount_cents ? String(ctx.default_discount_cents / 100) : '',
    })
    setDialogOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...draft,
      // Normalize empties to null for nullable FK columns.
      pipeline_id: draft.pipeline_id || null,
      stage_id: draft.stage_id || null,
      description: draft.description || null,
      location: draft.location || null,
    }
    const res = editingId
      ? await updateEventType(orgSlug, editingId, payload)
      : await createEventType(orgSlug, payload)
    if (res.ok && isClinic) {
      const eventTypeId = editingId || (res as any).id
      if (eventTypeId) {
        await upsertClinicServiceContext(orgSlug, eventTypeId, {
          specialty_id: draft.specialty_id || null,
          room_id: draft.room_id || null,
          professional_id: draft.professional_id || null,
          price_cents: draft.price ? Math.round(parseFloat(draft.price.replace(',', '.')) * 100) : null,
          default_discount_cents: draft.discount ? Math.round(parseFloat(draft.discount.replace(',', '.')) * 100) : 0,
        })
      }
    }
    setSaving(false)
    if (res.ok) {
      toast.success(editingId ? 'Atualizado' : `${label} criado`)
      setDialogOpen(false)
      refresh()
    } else {
      toast.error((res as any).error || 'Erro')
    }
  }

  async function handleToggle(et: EventType, on: boolean) {
    const res = await toggleEventTypeActive(orgSlug, et.id, on)
    if (res.ok) {
      toast.success(on ? 'Ativado' : 'Pausado')
      refresh()
    } else {
      toast.error(res.error)
    }
  }

  async function handleDelete(et: EventType) {
    const res = await deleteEventType(orgSlug, et.id)
    if (res.ok) {
      toast.success('Excluído')
      refresh()
    } else {
      toast.error(res.error)
    }
  }

  function copyPublicLink(et: EventType) {
    const url = `${window.location.origin}/book/${orgSlug}/${et.slug}`
    navigator.clipboard.writeText(url)
    toast.success('Link copiado')
  }

  function copyOrgBookingLink() {
    const url = `${window.location.origin}/book/${orgSlug}`
    navigator.clipboard.writeText(url)
    toast.success('Link da página de agendamentos copiado')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {eventTypes.length === 0
            ? `Nenhum ${labelLower} criado ainda`
            : `${eventTypes.length} tipo(s) de evento`}
        </p>

        <div className="flex items-center gap-2">
          {eventTypes.some(et => et.is_active) && (
            <Button variant="outline" onClick={copyOrgBookingLink} title="Copiar link da página com todos os agendamentos">
              <Copy className="w-4 h-4 mr-1" /> Link da página
            </Button>
          )}
          <EventTypesPanelDialog
            label={label}
            labelLower={labelLower}
            dialogOpen={dialogOpen}
            setDialogOpen={setDialogOpen}
            editingId={editingId}
            draft={draft}
            setDraft={setDraft}
            saving={saving}
            onOpenNew={openNew}
            onSubmit={handleSave}
            pipelines={pipelines}
            stages={stages}
            isClinic={isClinic}
            clinicSpecialties={clinicSpecialties}
            clinicRooms={clinicRooms}
            clinicProfessionals={clinicProfessionals}
            clinicSupplies={clinicSupplies}
            orgSlug={orgSlug}
          />
        </div>
      </div>

      {eventTypes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            <Calendar className="w-10 h-10 mx-auto opacity-40 mb-3" />
            <p className="mb-1 font-medium">Nenhum {labelLower}</p>
            <p>Crie um {labelLower} para começar a receber agendamentos.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">{label}</th>
                <th className="px-3 py-2 font-medium">Duração</th>
                {isClinic && <th className="px-3 py-2 font-medium">Profissional</th>}
                {isClinic && <th className="px-3 py-2 font-medium text-right">Preço</th>}
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {eventTypes.map(et => {
                const ctx = clinicServiceContexts[et.id]
                const professionalName = ctx?.professional_id
                  ? clinicProfessionals.find(p => p.id === ctx.professional_id)?.name || '—'
                  : 'Qualquer profissional'
                return (
                  <tr key={et.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: et.color || '#3b82f6' }} />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{et.name}</div>
                          {et.description && <div className="text-xs text-muted-foreground truncate max-w-[280px]">{et.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{et.duration_minutes} min</td>
                    {isClinic && <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{professionalName}</td>}
                    {isClinic && (
                      <td className="px-3 py-2.5 whitespace-nowrap text-right tabular-nums">
                        {ctx?.price_cents ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ctx.price_cents / 100) : '—'}
                      </td>
                    )}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Switch checked={et.is_active} onCheckedChange={c => handleToggle(et, c)} />
                        {!et.is_active && <Badge variant="outline" className="text-[10px]">Pausado</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => copyPublicLink(et)} title="Copiar link público">
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(et)} title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:bg-destructive/10" onClick={() => setEtToDelete(et)} title="Excluir">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!etToDelete} onOpenChange={o => !o && setEtToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {labelLower}?</AlertDialogTitle>
            <AlertDialogDescription>
              {etToDelete ? `Excluir "${etToDelete.name}"? ` : ''}Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleDelete(etToDelete!); setEtToDelete(null) }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

