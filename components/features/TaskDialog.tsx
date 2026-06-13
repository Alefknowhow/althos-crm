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
import LeadCombobox from '@/components/features/LeadCombobox'
import { taskSchema } from '@/lib/validators/task'
import { useState } from 'react'
import { Plus } from 'lucide-react'

type FormValues = z.infer<typeof taskSchema>

type Member = { user_id: string; name: string; email: string }

interface Props {
  orgSlug:     string
  defaultLead?: { id: string; name: string } | null
  trigger?:    React.ReactNode
  members?:    Member[]
}

export default function TaskDialog({ orgSlug, defaultLead, trigger, members = [] }: Props) {
  const router = useRouter()
  const [open, setOpen]         = useState(false)
  const [isPending, startTrans] = useTransition()

  const today = new Date().toISOString().split('T')[0]

  const form = useForm<FormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title:       '',
      description: '',
      due_date:    today,
      priority:    'normal',
      contato_id:     defaultLead?.id || '',
      assigned_to: '',
    },
  })

  async function onSubmit(values: FormValues) {
    startTrans(async () => {
      const res = await createTask(orgSlug, values as TaskInput)
      if (!res.ok) {
        toast.error(traduzirErro(res.error, 'Erro ao criar tarefa'))
        return
      }
      toast.success('Tarefa criada!')
      form.reset({
        title: '', description: '', due_date: today, priority: 'normal', contato_id: '', assigned_to: '',
      })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? <Button><Plus className="w-4 h-4 mr-1" /> Nova Tarefa</Button>}
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

              {/* Lead */}
              <FormField
                control={form.control}
                name="contato_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vincular a Lead <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                    <FormControl>
                      <LeadCombobox
                        name="contato_id"
                        orgSlug={orgSlug}
                        defaultLead={defaultLead || null}
                        onChange={(lead) => field.onChange(lead?.id || '')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
