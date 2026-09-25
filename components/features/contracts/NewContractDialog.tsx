'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { createContract } from '@/actions/contracts-global'

export default function NewContractDialog({
  orgSlug, templates, open, onOpenChange, onCreated,
}: {
  orgSlug: string
  templates: { id: string; name: string }[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!title.trim()) { toast.error('Informe um título para o contrato.'); return }
    setSaving(true)
    const res = await createContract(orgSlug, { title, templateId: templateId || null })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    setTitle('')
    setTemplateId('')
    onOpenChange(false)
    onCreated(res.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Novo contrato</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input placeholder="Ex: Contrato de prestação de serviços — Cliente X" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Modelo (opcional)</Label>
            <Select value={templateId || '__none__'} onValueChange={v => setTemplateId(v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Sem modelo — texto livre" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem modelo — texto livre</SelectItem>
                {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Modelos são gerenciados em Documentos → Modelos.</p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={handleCreate} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Criando…</> : 'Criar contrato'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
