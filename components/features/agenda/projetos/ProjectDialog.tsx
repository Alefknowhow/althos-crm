'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { traduzirErro } from '@/lib/utils/error-translator'

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ActionButton as Button } from '@/components/features/ActionButton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { createProject } from '@/actions/projects'

type ClientOption = { id: string; name: string }
type MemberOption = { user_id: string; name: string }

interface Props {
  orgSlug: string
  clients?: ClientOption[]
  members?: MemberOption[]
  /** Preenche e trava o cliente quando aberto de dentro da tela do cliente
   *  (aba Projetos) — o form nem mostra o seletor nesse caso. */
  defaultClientId?: string
  trigger?: React.ReactNode
}

export default function ProjectDialog({ orgSlug, clients = [], members = [], defaultClientId, trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTrans] = useTransition()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [objective, setObjective] = useState('')
  const [clientId, setClientId] = useState(defaultClientId || '')
  const [ownerId, setOwnerId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [tagsText, setTagsText] = useState('')

  function reset() {
    setName(''); setDescription(''); setObjective('')
    setClientId(defaultClientId || ''); setOwnerId(''); setStartDate(''); setDueDate(''); setTagsText('')
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTrans(async () => {
      const res = await createProject(orgSlug, {
        name, description, objective,
        client_id: clientId,
        owner_id: ownerId,
        start_date: startDate,
        due_date: dueDate,
        tags: tagsText.split(',').map(t => t.trim()).filter(Boolean),
      })
      if (!res.ok) {
        toast.error(traduzirErro(res.error, 'Erro ao criar projeto'))
        return
      }
      toast.success('Projeto criado!')
      reset()
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        {trigger ?? <Button title="Novo projeto"><Plus className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Novo Projeto</span></Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo Projeto</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Campanha Black Friday" required />
          </div>

          {!defaultClientId && (
            <div className="space-y-2">
              <Label>Cliente <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Select value={clientId || '__none__'} onValueChange={v => setClientId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum (uso interno)</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Objetivo</Label>
            <Input value={objective} onChange={e => setObjective(e.target.value)} placeholder="O que este projeto deve entregar?" />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} className="resize-none" placeholder="Detalhes opcionais..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Início</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Prazo</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          {members.length > 0 && (
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={ownerId || 'me'} onValueChange={v => setOwnerId(v === 'me' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">Eu (quem cria)</SelectItem>
                  {members.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Tags <span className="text-muted-foreground font-normal">(opcional, separadas por vírgula)</span></Label>
            <Input value={tagsText} onChange={e => setTagsText(e.target.value)} placeholder="Ex.: onboarding, prioridade-alta" />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>Cancelar</Button>
            <Button type="submit" pending={isPending} disabled={!name}>Criar projeto</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
