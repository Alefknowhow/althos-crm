'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { traduzirErro } from '@/lib/utils/error-translator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ActionButton } from '@/components/features/ActionButton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { applyProjectTemplate } from '@/actions/project-templates'
import type { ProjectTemplateRow } from '@/actions/project-templates'

type ClientOption = { id: string; name: string }
type MemberOption = { user_id: string; name: string }

/** YYYY-MM-DD do dia local do navegador — toISOString() usa UTC e "pula" pro
 *  dia seguinte pra usuários em UTC-3 depois das 21h (achado da revisão do
 *  PR #55). */
function localYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ApplyTemplateDialog({
  orgSlug, templates, clients = [], members = [], defaultClientId, trigger, open: openProp, onOpenChange,
}: {
  orgSlug: string
  templates: ProjectTemplateRow[]
  clients?: ClientOption[]
  members?: MemberOption[]
  defaultClientId?: string
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const router = useRouter()
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = onOpenChange ?? setOpenState
  const [isPending, startTrans] = useTransition()
  const [templateId, setTemplateId] = useState('')
  const [name, setName] = useState('')
  const [clientId, setClientId] = useState(defaultClientId || '')
  const [ownerId, setOwnerId] = useState('')
  const [startDate, setStartDate] = useState(() => localYmd())

  const template = templates.find(t => t.id === templateId)

  function reset() {
    setTemplateId(''); setName(''); setClientId(defaultClientId || ''); setOwnerId('')
    setStartDate(localYmd())
  }

  function submit() {
    if (!templateId || !name.trim()) return
    startTrans(async () => {
      const res = await applyProjectTemplate(orgSlug, templateId, {
        name: name.trim(), client_id: clientId, owner_id: ownerId, start_date: startDate,
      })
      if (!res.ok) { toast.error(traduzirErro(res.error, 'Erro ao aplicar template')); return }
      toast.success(`Projeto criado com ${res.tasksCreated} tarefa${res.tasksCreated !== 1 ? 's' : ''}!`)
      reset()
      setOpen(false)
      router.push(`/app/${orgSlug}/agenda/projetos/${res.id}`)
    })
  }

  if (templates.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset() }}>
      {trigger && <div onClick={() => setOpen(true)}>{trigger}</div>}
      <DialogContent>
        <DialogHeader><DialogTitle>Novo projeto a partir de um template</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Template *</Label>
            <Select value={templateId} onValueChange={v => { setTemplateId(v); const t = templates.find(x => x.id === v); if (t && !name) setName(t.name) }}>
              <SelectTrigger><SelectValue placeholder="Selecionar template" /></SelectTrigger>
              <SelectContent>
                {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.steps.length} passos)</SelectItem>)}
              </SelectContent>
            </Select>
            {template?.description && <p className="text-xs text-muted-foreground">{template.description}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Nome do projeto *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Onboarding — Cliente X" />
          </div>
          {!defaultClientId && clients.length > 0 && (
            <div className="space-y-1.5">
              <Label>Cliente <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Select value={clientId || '__none__'} onValueChange={v => setClientId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum (uso interno)</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data de início (base dos prazos)</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            {members.length > 0 && (
              <div className="space-y-1.5">
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
          </div>
        </div>
        <DialogFooter>
          <ActionButton variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>Cancelar</ActionButton>
          <ActionButton onClick={submit} pending={isPending} disabled={!templateId || !name.trim()}>Criar projeto</ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
