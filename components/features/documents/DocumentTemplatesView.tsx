'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import EmptyState from '@/components/ui/empty-state'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import TiptapEmailEditor from '@/components/features/email/TiptapEmailEditor'
import { cn } from '@/lib/utils'
import {
  createDocumentTemplate, updateDocumentTemplate, deleteDocumentTemplate,
  type DocumentTemplateRow,
} from '@/actions/document-templates'
import { toast } from 'sonner'
import { FileText, Plus, Trash2, ArrowLeft, Save, Info } from 'lucide-react'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

export default function DocumentTemplatesView({
  orgSlug, templates,
}: {
  orgSlug: string
  templates: DocumentTemplateRow[]
}) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(templates[0]?.id ?? null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)

  const selected = templates.find(t => t.id === selectedId) ?? null

  async function handleCreate() {
    if (!newName.trim()) { toast.error('Informe um nome pro modelo.'); return }
    setCreating(true)
    const res = await createDocumentTemplate(orgSlug, newName)
    setCreating(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Modelo criado')
    setNewOpen(false)
    setNewName('')
    setSelectedId(res.data.id)
    router.refresh()
  }

  async function handleSave(id: string, patch: { name?: string; category?: string | null; body_html?: string }) {
    setSaving(true)
    const res = await updateDocumentTemplate(orgSlug, id, patch)
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Modelo salvo')
    router.refresh()
  }

  async function handleDelete(id: string) {
    const res = await deleteDocumentTemplate(orgSlug, id)
    if (res.ok) {
      toast.success('Modelo excluído')
      if (selectedId === id) setSelectedId(null)
      router.refresh()
    } else toast.error(res.error)
  }

  if (templates.length === 0) {
    return (
      <>
        <div className="flex items-center justify-end mb-4">
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Novo modelo
          </Button>
        </div>
        <EmptyState
          icon={FileText}
          title="Nenhum modelo de documento ainda"
          description="Crie modelos como MEDIF, autorização de menor viajando ou declarações — cada campo entre {{chaves}} vira um campo de preenchimento na hora de gerar."
        />
        <NewTemplateDialog open={newOpen} onOpenChange={setNewOpen} name={newName} setName={setNewName} creating={creating} onCreate={handleCreate} />
      </>
    )
  }

  return (
    <>
      <div className="flex items-center justify-end mb-4">
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Novo modelo
        </Button>
      </div>

      <div className="grid md:grid-cols-[280px_1fr] gap-4 h-[calc(100dvh-19rem)] min-h-[440px]">
        <div className={cn('rounded-none border bg-card overflow-y-auto divide-y', selected && 'hidden md:block')}>
          {templates.map(t => {
            const active = t.id === selectedId
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={cn('w-full text-left p-3 transition-colors', FOCUS_RING, active ? 'bg-primary/5' : 'hover:bg-muted/50')}
              >
                <p className="font-medium text-sm truncate">{t.name}</p>
                {t.category && <p className="text-xs text-muted-foreground mt-0.5">{t.category}</p>}
              </button>
            )
          })}
        </div>

        <div className={cn('rounded-none border bg-card overflow-y-auto', !selected && 'hidden md:flex')}>
          {selected
            ? <TemplateEditor
                key={selected.id}
                orgSlug={orgSlug}
                template={selected}
                saving={saving}
                onBack={() => setSelectedId(null)}
                onDelete={() => setDeleteId(selected.id)}
                onSave={patch => handleSave(selected.id, patch)}
              />
            : (
              <div className="m-auto text-center text-sm text-muted-foreground p-8">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Selecione um modelo para editar.
              </div>
            )}
        </div>
      </div>

      <NewTemplateDialog open={newOpen} onOpenChange={setNewOpen} name={newName} setName={setNewName} creating={creating} onCreate={handleCreate} />

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita. Documentos já gerados a partir deste modelo não são afetados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleDelete(deleteId!); setDeleteId(null) }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function NewTemplateDialog({
  open, onOpenChange, name, setName, creating, onCreate,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  name: string
  setName: (v: string) => void
  creating: boolean
  onCreate: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Novo modelo de documento</DialogTitle>
          <DialogDescription>Dê um nome ao modelo — o conteúdo você edita depois.</DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-1">
          <Label className="text-xs">Nome</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Autorização de menor viajando" />
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={creating} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={creating} onClick={onCreate}>{creating ? 'Criando…' : 'Criar modelo'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TemplateEditor({
  orgSlug, template, saving, onSave, onBack, onDelete,
}: {
  orgSlug: string
  template: DocumentTemplateRow
  saving: boolean
  onSave: (patch: { name?: string; category?: string | null; body_html?: string }) => void
  onBack: () => void
  onDelete: () => void
}) {
  const [name, setName] = useState(template.name)
  const [category, setCategory] = useState(template.category || '')
  const [bodyHtml, setBodyHtml] = useState(template.body_html)

  return (
    <div className="flex flex-col w-full">
      <div className="sticky top-0 bg-card/90 border-b p-4 flex items-start gap-3 z-10">
        <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold truncate flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary shrink-0" /> {name || 'Modelo'}
          </h2>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          <Button variant="outline" size="sm" disabled={saving} onClick={() => onSave({ name, category: category || null, body_html: bodyHtml })}>
            <Save className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">{saving ? 'Salvando…' : 'Salvar'}</span>
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={onDelete} aria-label="Excluir">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Ex.: MEDIF, Menor viajando, Declaração…" />
          </div>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3 text-xs text-muted-foreground flex items-start gap-2">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
          Use <code className="px-1 rounded bg-muted">{'{{nome_do_campo}}'}</code> no texto pra marcar um campo que será
          preenchido manualmente na hora de gerar o documento (ex.: <code className="px-1 rounded bg-muted">{'{{nome_do_menor}}'}</code>).
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Conteúdo do modelo</Label>
          <TiptapEmailEditor orgSlug={orgSlug} value={bodyHtml} onChange={setBodyHtml} placeholder="Escreva o modelo aqui…" />
        </div>
      </div>
    </div>
  )
}
