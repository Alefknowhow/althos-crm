'use client'

/**
 * The edit-entry dialog for FinancialEntriesView. Split out of
 * FinancialEntriesView.tsx.
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  createFinancialEntry, uploadFinancialAttachment, deleteFinancialAttachment, getFinancialAttachmentUrl,
  type FinancialEntryRow,
} from '@/actions/financial'
import type { FinancialSettingType, FinancialSettingRow } from '@/actions/financial-settings'
import FinancialDocumentPanel from './FinancialDocumentPanel'
import LeadCombobox from '@/components/features/LeadCombobox'
import type { ExtractedFinancialDocument } from '@/lib/ai/financial-document-extract'
import { toast } from 'sonner'
import {
  Trash2, Save, Upload, Paperclip, FileIcon, ImageIcon, X, Loader2,
  TrendingUp, TrendingDown, Repeat, CreditCard, Copy, Sparkles,
} from 'lucide-react'
import { STATUS_LABELS, MoneyInput, Field, SettingSelect, withExtra, TipoToggle } from './FinancialEntriesShared'

export function EditEntryDialog({
  orgSlug, entry, settings, saving, open, onOpenChange, onSave, onDelete,
}: {
  orgSlug: string
  entry: FinancialEntryRow
  settings: Record<FinancialSettingType, FinancialSettingRow[]>
  saving: boolean
  open: boolean
  onOpenChange: (o: boolean) => void
  onSave: (patch: Record<string, any>) => void
  onDelete: () => void
}) {
  const router = useRouter()
  const [e, setE] = useState<FinancialEntryRow>(entry)
  const set = (k: keyof FinancialEntryRow, v: any) => setE(prev => ({ ...prev, [k]: v }))
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [tagsText, setTagsText] = useState((entry.tags || []).join(', '))
  const [duplicating, setDuplicating] = useState(false)
  const [ocrFile, setOcrFile] = useState<File | null>(null)
  const [previewAttachment, setPreviewAttachment] = useState<{ url: string; name: string } | null>(null)

  async function handleDuplicate() {
    setDuplicating(true)
    const res = await createFinancialEntry(orgSlug, {
      tipo: e.tipo, categoria: e.categoria, subcategoria: e.subcategoria, centro_custo: e.centro_custo,
      conta_bancaria: e.conta_bancaria, forma_pagamento: e.forma_pagamento, contato_id: e.contato_id,
      valor_cents: e.valor_cents, competencia: e.competencia, vencimento: e.vencimento,
      observacoes: e.observacoes,
      nota_fiscal: e.nota_fiscal, numero_documento: e.numero_documento,
      projeto: e.projeto, unidade_negocio: e.unidade_negocio,
    })
    setDuplicating(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Lançamento duplicado')
    router.refresh()
  }

  const patch = () => ({
    tipo: e.tipo, categoria: e.categoria, subcategoria: e.subcategoria, centro_custo: e.centro_custo,
    conta_bancaria: e.conta_bancaria, forma_pagamento: e.forma_pagamento, valor_cents: e.valor_cents,
    competencia: e.competencia, vencimento: e.vencimento, data_pagamento: e.data_pagamento,
    status: e.status, operadora: e.operadora, observacoes: e.observacoes, contato_id: e.contato_id,
    tags: tagsText.split(',').map(t => t.trim()).filter(Boolean),
    nota_fiscal: e.nota_fiscal, numero_documento: e.numero_documento,
    projeto: e.projeto, unidade_negocio: e.unidade_negocio,
  })

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await uploadFinancialAttachment(orgSlug, e.id, fd)
        if (res.ok) set('anexos', res.anexos)
        else toast.error(`${file.name}: ${res.error}`)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao enviar anexo.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleRemoveAttachment(path: string) {
    const res = await deleteFinancialAttachment(orgSlug, e.id, path)
    if (res.ok) set('anexos', res.anexos)
    else toast.error(res.error)
  }

  async function handleOpenAttachment(path: string, isImage: boolean, name: string) {
    const res = await getFinancialAttachmentUrl(orgSlug, e.id, path)
    if (!res.ok) { toast.error(res.error); return }
    if (isImage) setPreviewAttachment({ url: res.url, name })
    else window.open(res.url, '_blank', 'noopener,noreferrer')
  }

  async function applyExtracted(data: ExtractedFinancialDocument) {
    if (data.tipo) set('tipo', data.tipo)
    if (data.categoria_sugerida) set('categoria', data.categoria_sugerida)
    if (data.valor_cents) set('valor_cents', data.valor_cents)
    if (data.vencimento) set('vencimento', data.vencimento)
    if (data.numero_documento) set('numero_documento', data.numero_documento)
    // Lançamento já existe (estamos editando), então o anexo lido pode ser
    // salvo direto — diferente do fluxo de criação, que precisa esperar o
    // lançamento existir antes de subir o arquivo.
    if (ocrFile) {
      const fd = new FormData()
      fd.append('file', ocrFile)
      const res = await uploadFinancialAttachment(orgSlug, e.id, fd)
      if (res.ok) set('anexos', res.anexos)
      else toast.error(`Anexo não pôde ser salvo: ${res.error}`)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-6">
            <span className="flex items-center gap-2 truncate">
              {e.tipo === 'receita' ? <TrendingUp className="w-4 h-4 text-success shrink-0" /> : <TrendingDown className="w-4 h-4 text-destructive shrink-0" />}
              <span className="truncate">{e.categoria || 'Editar lançamento'}</span>
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="w-7 h-7" disabled={duplicating} onClick={handleDuplicate} aria-label="Duplicar" title="Duplicar lançamento">
                <Copy className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:bg-destructive/10" onClick={onDelete} aria-label="Excluir" title="Excluir lançamento">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <TipoToggle value={e.tipo} onChange={v => set('tipo', v)} />

          <Field label="Observações / descrição"><Textarea rows={2} value={e.observacoes || ''} onChange={ev => set('observacoes', ev.target.value)} /></Field>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Categoria">
              <SettingSelect value={e.categoria} onChange={v => set('categoria', v)} options={withExtra(settings.categoria, e.categoria)} required placeholder="Selecione a categoria" />
            </Field>
            <Field label="Subcategoria">
              <SettingSelect value={e.subcategoria} onChange={v => set('subcategoria', v)} options={withExtra(settings.subcategoria, e.subcategoria)} />
            </Field>
            <Field label="Centro de custo">
              <SettingSelect value={e.centro_custo} onChange={v => set('centro_custo', v)} options={withExtra(settings.centro_custo, e.centro_custo)} />
            </Field>
            <Field label="Valor"><MoneyInput value={e.valor_cents} onChange={c => set('valor_cents', c)} /></Field>
            <Field label="Competência"><Input type="date" value={e.competencia || ''} onChange={ev => set('competencia', ev.target.value)} /></Field>
            <Field label="Vencimento"><Input type="date" value={e.vencimento || ''} onChange={ev => set('vencimento', ev.target.value)} /></Field>
            <Field label="Data de pagamento"><Input type="date" value={e.data_pagamento || ''} onChange={ev => set('data_pagamento', ev.target.value)} /></Field>
            <Field label="Conta bancária">
              <SettingSelect value={e.conta_bancaria} onChange={v => set('conta_bancaria', v)} options={withExtra(settings.conta_bancaria, e.conta_bancaria)} />
            </Field>
            <Field label="Forma de pagamento">
              <SettingSelect value={e.forma_pagamento} onChange={v => set('forma_pagamento', v)} options={withExtra(settings.forma_pagamento, e.forma_pagamento)} />
            </Field>
            <Field label="Operadora">
              <SettingSelect value={e.operadora} onChange={v => set('operadora', v)} options={withExtra(settings.operadora, e.operadora)} />
            </Field>
            <Field label="Status">
              <Select value={e.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {(e.is_recurring || e.installment_group_id) && (
            <div className="rounded-lg border bg-muted/20 p-2.5 text-xs text-muted-foreground flex items-center gap-1.5">
              {e.is_recurring && <span className="flex items-center gap-1"><Repeat className="w-3.5 h-3.5" /> Faz parte de uma série recorrente.</span>}
              {e.installment_group_id && <span className="flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> Parcela {e.parcela_numero}/{e.parcela_total}.</span>}
              <span className="ml-auto">Edite só esta ocorrência — as demais da série não são afetadas.</span>
            </div>
          )}

          <Field label="Cliente ou fornecedor">
            <LeadCombobox orgSlug={orgSlug} name="contato_id" placeholder="Buscar contato…" onChange={lead => set('contato_id', lead?.id ?? null)} />
          </Field>

          <Field label="Tags (separadas por vírgula)">
            <Input value={tagsText} onChange={ev => setTagsText(ev.target.value)} placeholder="ex.: urgente, reembolsável" />
          </Field>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Número do documento"><Input value={e.numero_documento || ''} onChange={ev => set('numero_documento', ev.target.value)} /></Field>
            <Field label="Nota fiscal"><Input value={e.nota_fiscal || ''} onChange={ev => set('nota_fiscal', ev.target.value)} /></Field>
            <Field label="Projeto"><Input value={e.projeto || ''} onChange={ev => set('projeto', ev.target.value)} /></Field>
            <Field label="Unidade de negócio"><Input value={e.unidade_negocio || ''} onChange={ev => set('unidade_negocio', ev.target.value)} /></Field>
          </div>

          <Field label="Anexos">
            <div className="space-y-2">
              {e.anexos?.length > 0 && (
                <ul className="space-y-1.5">
                  {e.anexos.map((a, i) => {
                    const isPdf = a.mime_type === 'application/pdf'
                    const isImage = !isPdf && (a.mime_type?.startsWith('image/') ?? false)
                    const key = a.storage_object_id ?? a.path
                    return (
                      <li key={`${key}-${i}`} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5">
                        {isPdf ? <FileIcon className="w-4 h-4 text-rose-500 shrink-0" /> : <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />}
                        <button type="button" onClick={() => handleOpenAttachment(key!, isImage, a.name)} className="flex-1 min-w-0 truncate text-left text-xs text-foreground hover:underline">
                          {a.name}
                        </button>
                        <button type="button" onClick={() => handleRemoveAttachment(key!)} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="Remover anexo">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              <input ref={fileRef} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={ev => handleFiles(ev.target.files)} />
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Enviando…</> : <><Upload className="w-3.5 h-3.5 mr-1.5" /> Adicionar anexo</>}
              </Button>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Paperclip className="w-3 h-3" /> PDF ou imagem, até 15 MB cada.</p>

              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><Sparkles className="w-3 h-3" /> Ler novo documento com IA</summary>
                <div className="pt-2">
                  <FinancialDocumentPanel
                    orgSlug={orgSlug}
                    file={ocrFile}
                    onFileSelected={setOcrFile}
                    onExtracted={applyExtracted}
                  />
                </div>
              </details>
            </div>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving} onClick={() => onSave(patch())}>
            <Save className="w-3.5 h-3.5 mr-1.5" /> {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {previewAttachment && (
      <Dialog open onOpenChange={o => !o && setPreviewAttachment(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate">{previewAttachment.name}</DialogTitle>
          </DialogHeader>
          <img src={previewAttachment.url} alt={previewAttachment.name} className="w-full max-h-[75vh] object-contain rounded-md" />
        </DialogContent>
      </Dialog>
    )}
    </>
  )
}
