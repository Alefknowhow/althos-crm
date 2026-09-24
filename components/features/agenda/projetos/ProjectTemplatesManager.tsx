'use client'

/** Gerenciar templates de Projeto (issue #17 §6) — lista simples + form de
 *  criação/edição com steps em linhas (título/dias/prioridade/grupo), sem
 *  drag-reorder nem editor visual (a issue pede explicitamente pra não
 *  construir estrutura extensa demais). */

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Layers, Plus, Trash2, Pencil, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ActionButton } from '@/components/features/ActionButton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  createProjectTemplate, updateProjectTemplate, deleteProjectTemplate,
  type ProjectTemplateRow,
} from '@/actions/project-templates'
import type { ProjectTemplateStep } from '@/lib/validators/project-template'

function emptyStep(): ProjectTemplateStep {
  return { title: '', offset_days: 0, priority: 'normal', group: '' }
}

export default function ProjectTemplatesManager({
  orgSlug, templates, trigger, open: openProp, onOpenChange,
}: {
  orgSlug: string
  templates: ProjectTemplateRow[]
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const router = useRouter()
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = onOpenChange ?? setOpenState
  const [editing, setEditing] = useState<ProjectTemplateRow | 'new' | null>(null)
  const [isPending, startTrans] = useTransition()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<ProjectTemplateStep[]>([emptyStep()])

  useEffect(() => {
    if (editing === 'new') {
      setName(''); setDescription(''); setSteps([emptyStep()])
    } else if (editing) {
      setName(editing.name); setDescription(editing.description || ''); setSteps(editing.steps.length ? editing.steps : [emptyStep()])
    }
  }, [editing])

  function updateStep(i: number, patch: Partial<ProjectTemplateStep>) {
    setSteps(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }

  function save() {
    const cleanSteps = steps.filter(s => s.title.trim()).map(s => ({ ...s, title: s.title.trim(), group: s.group?.trim() || undefined }))
    if (!name.trim() || cleanSteps.length === 0) {
      toast.error('Nome e ao menos um passo com título são obrigatórios.')
      return
    }
    startTrans(async () => {
      const input = { name: name.trim(), description: description.trim() || undefined, steps: cleanSteps }
      const res = editing !== 'new' && editing
        ? await updateProjectTemplate(orgSlug, editing.id, input)
        : await createProjectTemplate(orgSlug, input)
      if (!res.ok) { toast.error(res.error || 'Erro ao salvar template'); return }
      toast.success('Template salvo!')
      setEditing(null)
      router.refresh()
    })
  }

  function remove(id: string, tplName: string) {
    if (!confirm(`Excluir o template "${tplName}"? Projetos já criados a partir dele não são afetados.`)) return
    startTrans(async () => {
      const res = await deleteProjectTemplate(orgSlug, id)
      if (!res.ok) { toast.error(res.error || 'Erro ao excluir template'); return }
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null) }}>
      {trigger && <div onClick={() => setOpen(true)}>{trigger}</div>}
      <DialogContent className="max-w-lg">
        {!editing ? (
          <>
            <DialogHeader><DialogTitle>Templates de projeto</DialogTitle></DialogHeader>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {templates.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhum template ainda.</p>}
              {templates.map(t => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                  <Layers className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.steps.length} passo{t.steps.length !== 1 ? 's' : ''}</div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(t)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(t.id, t.name)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={() => setEditing('new')}><Plus className="w-4 h-4 mr-1" /> Novo template</Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-6 w-6 -ml-1" onClick={() => setEditing(null)}><ArrowLeft className="w-3.5 h-3.5" /></Button>
                {editing === 'new' ? 'Novo template' : 'Editar template'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Onboarding de cliente novo" />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} className="resize-none" rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label>Passos (viram Tasks — dias são relativos à data de início do projeto)</Label>
                {steps.map((s, i) => (
                  <div key={i} className="grid grid-cols-[1fr_70px_90px_auto] gap-1.5 items-center">
                    <Input placeholder="Título" value={s.title} onChange={e => updateStep(i, { title: e.target.value })} />
                    <Input type="number" min={0} placeholder="Dias" value={s.offset_days} onChange={e => updateStep(i, { offset_days: parseInt(e.target.value, 10) || 0 })} />
                    <Select value={s.priority || 'normal'} onValueChange={v => updateStep(i, { priority: v as any })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="normal">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => setSteps(prev => prev.filter((_, idx) => idx !== i))}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setSteps(prev => [...prev, emptyStep()])}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Passo
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditing(null)} disabled={isPending}>Cancelar</Button>
              <ActionButton onClick={save} pending={isPending}>Salvar template</ActionButton>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
