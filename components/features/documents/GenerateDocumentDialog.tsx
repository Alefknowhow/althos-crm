'use client'

import { useMemo, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { extractFieldKeys, humanizeFieldKey } from '@/lib/documents/merge-fields'
import { generateDocument } from '@/actions/generated-documents'
import type { DocumentTemplateRow } from '@/actions/document-templates'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'

export default function GenerateDocumentDialog({
  orgSlug, templates, open, onOpenChange, onGenerated,
}: {
  orgSlug: string
  templates: DocumentTemplateRow[]
  open: boolean
  onOpenChange: (o: boolean) => void
  onGenerated: (id: string) => void
}) {
  const [templateId, setTemplateId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)

  const template = templates.find(t => t.id === templateId) || null
  const fieldKeys = useMemo(() => template ? extractFieldKeys(template.body_html) : [], [template])

  function reset() {
    setTemplateId(''); setTitle(''); setFieldValues({})
  }

  function handlePickTemplate(id: string) {
    setTemplateId(id)
    const t = templates.find(x => x.id === id)
    if (t && !title) setTitle(t.name)
    setFieldValues({})
  }

  async function handleGenerate() {
    if (!templateId) { toast.error('Selecione um modelo.'); return }
    if (!title.trim()) { toast.error('Informe um título pro documento.'); return }
    setGenerating(true)
    const res = await generateDocument(orgSlug, { templateId, title, fieldValues })
    setGenerating(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Documento gerado')
    reset()
    onOpenChange(false)
    onGenerated(res.data.id)
  }

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Gerar documento</DialogTitle>
          <DialogDescription>Escolha um modelo e preencha os campos manualmente.</DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-1">
            <Label className="text-xs">Modelo</Label>
            <Select value={templateId} onValueChange={handlePickTemplate}>
              <SelectTrigger><SelectValue placeholder="Selecione um modelo" /></SelectTrigger>
              <SelectContent>
                {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {template && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Título do documento</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} />
              </div>

              {fieldKeys.length > 0 ? (
                <div className="space-y-2.5 rounded-lg border bg-muted/20 p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Campos do modelo</p>
                  {fieldKeys.map(key => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{humanizeFieldKey(key)}</Label>
                      <Input
                        value={fieldValues[key] || ''}
                        onChange={e => setFieldValues(prev => ({ ...prev, [key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Este modelo não tem campos pra preencher.</p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={generating} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={generating || !templateId} onClick={handleGenerate}>{generating ? 'Gerando…' : 'Gerar documento'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
