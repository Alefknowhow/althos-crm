'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { traduzirErro } from '@/lib/utils/error-translator'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { createTask, type TaskInput } from '@/actions/tasks'
import RelatedEntityCombobox, { type RelatedOption } from '@/components/features/tasks/RelatedEntityCombobox'
import { relatedTypeOptions, type RelatedTypeValue } from '@/lib/tasks/related-types'
import { taskSchema } from '@/lib/validators/task'
import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'

type FormValues = z.infer<typeof taskSchema>

type Member = { user_id: string; name: string; email: string }

/** Combina data (YYYY-MM-DD) + horário opcional (HH:mm) num ISO em UTC —
 *  mesma âncora usada em TasksBoard.tsx (dueDateOnly/fmtDate também tratam
 *  a data como UTC pra nunca "pular" de dia por causa do fuso do navegador). */
function combineDueDate(date: string, time: string): string {
  if (!date) return ''
  return `${date}T${time || '00:00'}:00.000Z`
}

interface Props {
  orgSlug:     string
  defaultLead?: { id: string; name: string } | null
  trigger?:    React.ReactNode
  members?:    Member[]
  /** Preenche data/horário ao criar a partir de um dia/horário específico
   *  do calendário (ex.: clique num dia da grade, ou num slot da timeline). */
  defaultDate?: string
  defaultTime?: string
  /** Controle externo do open state — usado quando o calendário abre este
   *  diálogo programaticamente (sem trigger próprio visível). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Vincula a tarefa criada a uma reserva (Reservas → aba Tarefas → "+ Nova tarefa"). */
  saleId?: string
  /** Nicho da org — filtra as opções de tipo em "Relacionado a". Sem isso,
   *  cai no conjunto genérico (Contato/Agendamento/Venda). */
  niche?: string | null
}

export default function TaskDialog({ orgSlug, defaultLead, trigger, members = [], defaultDate, defaultTime, open: openProp, onOpenChange, saleId, niche }: Props) {
  const router = useRouter()
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = onOpenChange ?? setOpenState
  const [isPending, startTrans] = useTransition()
  const [dueTime, setDueTime]   = useState(defaultTime || '')
  const [relatedType, setRelatedType] = useState<RelatedTypeValue>(defaultLead ? 'contato' : 'contato')
  const [relatedOption, setRelatedOption] = useState<RelatedOption | null>(defaultLead ? { id: defaultLead.id, label: defaultLead.name } : null)

  const typeOptions = relatedTypeOptions(niche)

  const today = new Date().toISOString().split('T')[0]

  const form = useForm<FormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title:       '',
      description: '',
      due_date:    defaultDate || today,
      priority:    'normal',
      contato_id:     defaultLead?.id || '',
      assigned_to: '',
    },
  })

  // Reabre sempre com a data/horário do dia clicado no calendário (o form
  // não remonta entre aberturas, então sem isso o valor ficaria preso ao
  // primeiro `defaultDate` recebido).
  useEffect(() => {
    if (open) {
      form.reset({
        title: '', description: '', due_date: defaultDate || today, priority: 'normal',
        contato_id: defaultLead?.id || '', assigned_to: '',
      })
      setDueTime(defaultTime || '')
      setRelatedType('contato')
      setRelatedOption(defaultLead ? { id: defaultLead.id, label: defaultLead.name } : null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDate, defaultTime, defaultLead])

  async function onSubmit(values: FormValues) {
    startTrans(async () => {
      const relationPayload =
        relatedType === 'contato' ? { contato_id: relatedOption?.id || '' }
        : relatedType === 'reserva' ? { sale_id: relatedOption?.id || '' }
        : { related_entity_type: (relatedOption ? relatedType : '') as any, related_entity_id: relatedOption?.id || '' }
      const payload = {
        ...values,
        ...relationPayload,
        due_date: combineDueDate(values.due_date || '', dueTime),
        ...(saleId ? { sale_id: saleId } : {}),
      }
      const res = await createTask(orgSlug, payload as TaskInput)
      if (!res.ok) {
        toast.error(traduzirErro(res.error, 'Erro ao criar tarefa'))
        return
      }
      toast.success('Tarefa criada!')
      form.reset({
        title: '', description: '', due_date: today, priority: 'normal', contato_id: '', assigned_to: '',
      })
      setDueTime('')
      setRelatedType('contato')
      setRelatedOption(null)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? <Button title="Nova Tarefa" aria-label="Nova Tarefa"><Plus className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Nova Tarefa</span></Button>}
        </DialogTrigger>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Título */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título *</FormLabel>
                    <FormControl>
                      <Input placeholder="O que precisa ser feito?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Descrição */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detalhes opcionais..."
                        className="resize-none"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                {/* Data */}
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vencimento</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Horário (opcional) — não é campo do react-hook-form (state
                    local dueTime), por isso usa Label/Input soltos em vez de
                    FormItem/FormLabel/FormControl (que exigem estar dentro de
                    um <FormField>, senão o useFormField() interno quebra). */}
                <div className="space-y-2">
                  <Label>Horário <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <Input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Prioridade */}
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridade</FormLabel>
                      <Select value={field.value ?? 'normal'} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Baixa</SelectItem>
                          <SelectItem value="normal">Média</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Responsável */}
              {members.length > 0 && (
                <FormField
                  control={form.control}
                  name="assigned_to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsável</FormLabel>
                      <Select value={field.value || 'me'} onValueChange={v => field.onChange(v === 'me' ? '' : v)}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="me">Eu (quem cria)</SelectItem>
                          {members.map(m => (
                            <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Relacionado a: tipo + registro específico, lado a lado */}
              <div className="space-y-2">
                <Label>Relacionado a <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={relatedType}
                    onValueChange={v => { setRelatedType(v as RelatedTypeValue); setRelatedOption(null) }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {typeOptions.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <RelatedEntityCombobox
                    orgSlug={orgSlug}
                    entityType={relatedType}
                    defaultValue={relatedOption}
                    onChange={setRelatedOption}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Salvando…' : 'Criar tarefa'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
