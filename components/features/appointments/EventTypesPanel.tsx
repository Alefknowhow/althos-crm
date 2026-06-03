'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Copy, Trash2, Pencil, Calendar } from 'lucide-react'
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

type Props = {
  orgSlug: string
  eventTypes: EventType[]
  pipelines: Pipeline[]
  stages: Stage[]
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
}

export default function EventTypesPanel({ orgSlug, eventTypes, pipelines, stages }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState(DEFAULT_DRAFT)
  const [saving, setSaving] = useState(false)
  const [etToDelete, setEtToDelete] = useState<EventType | null>(null)

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
    setSaving(false)
    if (res.ok) {
      toast.success(editingId ? 'Atualizado' : 'Tipo de evento criado')
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

  const stagesForPipeline = stages.filter(s => !draft.pipeline_id || s.pipeline_id === draft.pipeline_id)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {eventTypes.length === 0
            ? 'Nenhum tipo de evento criado ainda'
            : `${eventTypes.length} tipo(s) de evento`}
        </p>

        <div className="flex items-center gap-2">
          {eventTypes.some(et => et.is_active) && (
            <Button variant="outline" onClick={copyOrgBookingLink} title="Copiar link da página com todos os agendamentos">
              <Copy className="w-4 h-4 mr-1" /> Link da página
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="w-4 h-4 mr-1" /> Novo tipo de evento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar tipo de evento' : 'Novo tipo de evento'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2 col-span-2">
                  <Label>Nome *</Label>
                  <Input
                    value={draft.name}
                    onChange={e => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Ex: Avaliação inicial 30min"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Duração (min) *</Label>
                  <Input
                    type="number"
                    min={5}
                    max={480}
                    value={draft.duration_minutes}
                    onChange={e => setDraft({ ...draft, duration_minutes: Number(e.target.value) })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Cor</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draft.color}
                      onChange={e => setDraft({ ...draft, color: e.target.value })}
                      className="h-9 w-12 rounded border cursor-pointer"
                    />
                    <Input
                      value={draft.color}
                      onChange={e => setDraft({ ...draft, color: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2 col-span-2">
                  <Label>Descrição (aparece na página pública)</Label>
                  <Textarea
                    rows={2}
                    value={draft.description}
                    onChange={e => setDraft({ ...draft, description: e.target.value })}
                    placeholder="Ex: Conversa inicial para entender suas necessidades."
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label>Local / Link</Label>
                  <Input
                    value={draft.location}
                    onChange={e => setDraft({ ...draft, location: e.target.value })}
                    placeholder="Ex: Av. Brasil 123 · ou link do Google Meet"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Buffer antes (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={120}
                    value={draft.buffer_before_minutes}
                    onChange={e =>
                      setDraft({ ...draft, buffer_before_minutes: Number(e.target.value) })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Buffer depois (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={120}
                    value={draft.buffer_after_minutes}
                    onChange={e =>
                      setDraft({ ...draft, buffer_after_minutes: Number(e.target.value) })
                    }
                  />
                </div>

                {pipelines.length > 0 && (
                  <>
                    <div className="space-y-2">
                      <Label>Pipeline para o lead</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                        value={draft.pipeline_id}
                        onChange={e =>
                          setDraft({ ...draft, pipeline_id: e.target.value, stage_id: '' })
                        }
                      >
                        <option value="">(Nenhum)</option>
                        {pipelines.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label>Estágio inicial</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                        value={draft.stage_id}
                        onChange={e => setDraft({ ...draft, stage_id: e.target.value })}
                        disabled={!draft.pipeline_id}
                      >
                        <option value="">(Padrão)</option>
                        {stagesForPipeline.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              <DialogFooter>
                <Button type="submit" disabled={saving || draft.name.length < 2}>
                  {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {eventTypes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            <Calendar className="w-10 h-10 mx-auto opacity-40 mb-3" />
            <p className="mb-1 font-medium">Nenhum tipo de evento</p>
            <p>Crie um tipo de evento para começar a receber agendamentos.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {eventTypes.map(et => (
            <Card key={et.id} className="overflow-hidden">
              <div
                className="h-1.5 w-full"
                style={{ backgroundColor: et.color || '#3b82f6' }}
              />
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{et.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {et.duration_minutes} min · /{et.slug}
                    </p>
                  </div>
                  <Switch
                    checked={et.is_active}
                    onCheckedChange={c => handleToggle(et, c)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {et.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{et.description}</p>
                )}
                {et.location && (
                  <p className="text-xs">
                    <span className="text-muted-foreground">Local:</span> {et.location}
                  </p>
                )}
                {!et.is_active && (
                  <Badge variant="outline" className="text-xs">
                    Pausado
                  </Badge>
                )}

                <div className="flex items-center gap-1 pt-2 border-t mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyPublicLink(et)}
                    title="Copiar link público"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" /> Link
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(et)}
                    title="Editar"
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                  </Button>
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEtToDelete(et)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!etToDelete} onOpenChange={o => !o && setEtToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tipo de evento?</AlertDialogTitle>
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
