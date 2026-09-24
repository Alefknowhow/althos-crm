'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { traduzirErro } from '@/lib/utils/error-translator'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ActionButton as Button } from '@/components/features/ActionButton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2 } from 'lucide-react'

import { createEvent, updateEvent, deleteEvent, type EventRow } from '@/actions/events'
import RelatedEntityCombobox, { type RelatedOption } from '@/components/features/tasks/RelatedEntityCombobox'
import { relatedTypeOptions, type RelatedTypeValue } from '@/lib/tasks/related-types'
import { eventSchema, EVENT_TYPES, EVENT_TYPE_LABEL } from '@/lib/validators/event'

type FormValues = z.infer<typeof eventSchema>
type Member = { user_id: string; name: string; email: string }

function todayStr() { return new Date().toISOString().split('T')[0] }

interface Props {
  orgSlug: string
  members?: Member[]
  niche?: string | null
  trigger?: React.ReactNode
  /** Preenche data/horário ao criar a partir de um dia/horário do calendário. */
  defaultDate?: string
  defaultTime?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Presente = modo edição. */
  event?: EventRow | null
  onSaved?: () => void
  onDeleted?: () => void
}

export default function EventDialog({
  orgSlug, members = [], niche, trigger, defaultDate, defaultTime,
  open: openProp, onOpenChange, event, onSaved, onDeleted,
}: Props) {
  const router = useRouter()
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = onOpenChange ?? setOpenState
  const [isPending, startTrans] = useTransition()
  const isEditing = !!event

  const [relatedType, setRelatedType] = useState<RelatedTypeValue>('contato')
  const [relatedOption, setRelatedOption] = useState<RelatedOption | null>(null)
  const typeOptions = relatedTypeOptions(niche).filter(o => o.value !== 'reserva')

  const form = useForm<FormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '', description: '', notes: '',
      start_date: defaultDate || todayStr(),
      start_time: defaultTime || '',
      end_date: '', end_time: '',
      all_day: false,
      event_type: 'presencial',
      location: '',
      organizer_id: '',
      participant_ids: [],
    },
  })

  useEffect(() => {
    if (!open) return
    if (event) {
      const start = new Date(event.start_at)
      const end = new Date(event.end_at)
      const toDateStr = (d: Date) => d.toISOString().split('T')[0]
      const toTimeStr = (d: Date) => d.toISOString().slice(11, 16)
      form.reset({
        title: event.title,
        description: event.description || '',
        notes: event.notes || '',
        start_date: toDateStr(start),
        start_time: event.all_day ? '' : toTimeStr(start),
        end_date: toDateStr(end),
        end_time: event.all_day ? '' : toTimeStr(end),
        all_day: event.all_day,
        event_type: (event.event_type as any) || 'presencial',
        location: event.location || '',
        organizer_id: event.organizer_id || '',
        participant_ids: event.participant_ids || [],
      })
      if (event.contato_id) {
        setRelatedType('contato')
        setRelatedOption(event.contatos ? { id: event.contatos.id, label: event.contatos.name } : { id: event.contato_id, label: 'Contato' })
      } else if (event.related_entity_type && event.related_entity_id) {
        setRelatedType(event.related_entity_type as RelatedTypeValue)
        setRelatedOption({ id: event.related_entity_id, label: 'Selecionado' })
      } else {
        setRelatedType('contato')
        setRelatedOption(null)
      }
    } else {
      form.reset({
        title: '', description: '', notes: '',
        start_date: defaultDate || todayStr(), start_time: defaultTime || '',
        end_date: '', end_time: '', all_day: false,
        event_type: 'presencial', location: '', organizer_id: '', participant_ids: [],
      })
      setRelatedType('contato')
      setRelatedOption(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event, defaultDate, defaultTime])

  async function onSubmit(values: FormValues) {
    startTrans(async () => {
      const relationPayload =
        relatedType === 'contato' ? { contato_id: relatedOption?.id || '' }
        : { related_entity_type: (relatedOption ? relatedType : '') as any, related_entity_id: relatedOption?.id || '' }
      const payload = { ...values, ...relationPayload }

      const res = isEditing
        ? await updateEvent(orgSlug, event!.id, payload)
        : await createEvent(orgSlug, payload as FormValues)

      if (!res.ok) {
        toast.error(traduzirErro(res.error, isEditing ? 'Erro ao salvar evento' : 'Erro ao criar evento'))
        return
      }
      toast.success(isEditing ? 'Evento atualizado!' : 'Evento criado!')
      setOpen(false)
      onSaved?.()
      router.refresh()
    })
  }

  function onDelete() {
    if (!event) return
    startTrans(async () => {
      const res = await deleteEvent(orgSlug, event.id)
      if (!res.ok) { toast.error(traduzirErro(res.error, 'Erro ao excluir evento')); return }
      toast.success('Evento excluído')
      setOpen(false)
      onDeleted?.()
      router.refresh()
    })
  }

  const allDay = form.watch('all_day')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar evento' : 'Novo evento'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Título *</FormLabel>
                <FormControl><Input placeholder="Ex.: Reunião com o cliente" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex items-center gap-2">
              <Checkbox id="all-day" checked={!!allDay} onCheckedChange={v => form.setValue('all_day', !!v)} />
              <Label htmlFor="all-day" className="font-normal cursor-pointer">Dia inteiro</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="start_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {!allDay && (
                <FormField control={form.control} name="start_time" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Início</FormLabel>
                    <FormControl><Input type="time" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="end_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data final <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {!allDay && (
                <FormField control={form.control} name="end_time" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fim</FormLabel>
                    <FormControl><Input type="time" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="event_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select value={field.value ?? 'presencial'} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{EVENT_TYPE_LABEL[t]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel>Local <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                  <FormControl><Input placeholder="Endereço, sala..." {...field} value={field.value ?? ''} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {members.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="organizer_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organizador</FormLabel>
                    <Select value={field.value || 'me'} onValueChange={v => field.onChange(v === 'me' ? '' : v)}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="me">Eu (quem cria)</SelectItem>
                        {members.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="participant_ids" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Participantes <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                    <Select
                      value=""
                      onValueChange={v => {
                        const current = field.value ?? []
                        if (!current.includes(v)) field.onChange([...current, v])
                      }}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="Adicionar..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {members.filter(m => !(field.value ?? []).includes(m.user_id)).map(m => (
                          <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!!(field.value ?? []).length && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {(field.value ?? []).map(uid => {
                          const m = members.find(mm => mm.user_id === uid)
                          return (
                            <span key={uid} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full">
                              {m?.name || uid}
                              <button type="button" onClick={() => field.onChange((field.value ?? []).filter(id => id !== uid))} aria-label="Remover">×</button>
                            </span>
                          )
                        })}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}

            <div className="space-y-2">
              <Label>Relacionado a <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={relatedType} onValueChange={v => { setRelatedType(v as RelatedTypeValue); setRelatedOption(null) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {typeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <RelatedEntityCombobox orgSlug={orgSlug} entityType={relatedType} defaultValue={relatedOption} onChange={setRelatedOption} />
              </div>
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição</FormLabel>
                <FormControl><Textarea placeholder="Detalhes opcionais..." className="resize-none" {...field} value={field.value ?? ''} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter className="gap-2 sm:justify-between">
              {isEditing ? (
                <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete} disabled={isPending}>
                  <Trash2 className="w-4 h-4 mr-1" /> Excluir
                </Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>Cancelar</Button>
                <Button type="submit" pending={isPending}>{isEditing ? 'Salvar' : 'Criar evento'}</Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
