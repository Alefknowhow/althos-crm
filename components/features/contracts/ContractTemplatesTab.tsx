'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Plus, FileText, Pencil, Trash2, Info } from 'lucide-react'
import TiptapEmailEditor from '@/components/features/email/TiptapEmailEditor'
import {
  createDocumentTemplate, updateDocumentTemplate, deleteDocumentTemplate,
  type DocumentTemplateRow,
} from '@/actions/document-templates'

/** Modelos de contrato (issue de reorganização do módulo Contratos) — são
 *  `document_templates` marcados com category 'Contrato' por convenção,
 *  reaproveitando 100% o CRUD já usado em Documentos → Modelos. O editor
 *  abre em popup "estilo Word" (TiptapEmailEditor, mesmo componente do
 *  Gerador de E-mail), em vez do painel lateral usado em Documentos. */
export default function ContractTemplatesTab({
  orgSlug, templates,
}: { orgSlug: string; templates: DocumentTemplateRow[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<DocumentTemplateRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [savingNew, setSavingNew] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function handleCreate() {
    if (!newName.trim()) { toast.error('Informe um nome pro modelo.'); return }
    setSavingNew(true)
    const res = await createDocumentTemplate(orgSlug, newName)
    if (!res.ok) { setSavingNew(false); toast.error(res.error); return }
    await updateDocumentTemplate(orgSlug, res.data.id, { category: 'Contrato' })
    setSavingNew(false)
    setCreating(false)
    setNewName('')
    toast.success('Modelo de contrato criado')
    router.refresh()
    setEditing({ ...res.data, category: 'Contrato' })
  }

  async function handleDelete(id: string) {
    const res = await deleteDocumentTemplate(orgSlug, id)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Modelo excluído')
    setDeleteId(null)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Modelos de contrato</h3>
          <p className="text-xs text-muted-foreground">Contratos padrão pré-preenchidos — use {'{{sale.*}}'}/{'{{org.*}}'} pra campos automáticos.</p>
        </div>
        <Button type="button" size="sm" onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Novo modelo
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 p-8 text-center space-y-2">
          <FileText className="w-6 h-6 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum modelo de contrato ainda.</p>
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {templates.map(t => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="flex-1 min-w-0 truncate text-sm font-medium">{t.name}</span>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(t)}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
              </Button>
              <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(t.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo modelo de contrato</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex.: Contrato de prestação de serviços" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreating(false)} disabled={savingNew}>Cancelar</Button>
            <Button type="button" onClick={handleCreate} disabled={savingNew}>{savingNew ? 'Criando…' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editing && (
        <TemplateEditorDialog
          orgSlug={orgSlug}
          template={editing}
          onOpenChange={open => !open && setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh() }}
        />
      )}

      <Dialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir modelo</DialogTitle>
            <DialogDescription>Contratos já gerados a partir deste modelo não são afetados.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button type="button" variant="destructive" onClick={() => handleDelete(deleteId!)}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TemplateEditorDialog({
  orgSlug, template, onOpenChange, onSaved,
}: {
  orgSlug: string
  template: DocumentTemplateRow
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [name, setName] = useState(template.name)
  const [bodyHtml, setBodyHtml] = useState(template.body_html)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const res = await updateDocumentTemplate(orgSlug, template.id, { name, body_html: bodyHtml, category: 'Contrato' })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Modelo salvo')
    onSaved()
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar modelo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 overflow-y-auto flex-1 min-h-0">
          <Input value={name} onChange={e => setName(e.target.value)} className="font-medium" />
          <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-2.5 text-xs text-muted-foreground flex items-start gap-2">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
            Use <code className="px-1 rounded bg-muted">{'{{sale.cliente}}'}</code>, <code className="px-1 rounded bg-muted">{'{{sale.valor_total}}'}</code>, <code className="px-1 rounded bg-muted">{'{{org.nome}}'}</code> etc. — resolvidos automaticamente a partir da venda vinculada.
          </div>
          <TiptapEmailEditor orgSlug={orgSlug} value={bodyHtml} onChange={setBodyHtml} placeholder="Escreva o modelo do contrato…" />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={handleSave} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
