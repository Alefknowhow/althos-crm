'use client'

import { useState, useTransition, useRef } from 'react'
import {
  createWaTemplate, updateWaTemplate, deleteWaTemplate, uploadWaMedia,
  type WaTemplate, type WaTemplatePayload,
} from '@/actions/whatsapp-templates'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, ImageIcon, FileText, Video, X, Upload, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

// ── Helpers ───────────────────────────────────────────────────────────────────

function categoryColor(c: string) {
  if (c === 'MARKETING')      return 'bg-pink-100 text-pink-700'
  if (c === 'AUTHENTICATION') return 'bg-blue-100 text-blue-700'
  return 'bg-violet-100 text-violet-700'
}
function statusColor(s: string) {
  if (s === 'approved') return 'bg-emerald-100 text-emerald-700'
  if (s === 'rejected') return 'bg-red-100 text-red-700'
  if (s === 'pending')  return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-600'
}
function statusLabel(s: string) {
  if (s === 'approved') return 'Aprovado'
  if (s === 'rejected') return 'Rejeitado'
  if (s === 'pending')  return 'Pendente'
  return 'Local'
}
function headerIcon(t: string) {
  if (t === 'image')    return <ImageIcon className="w-3.5 h-3.5" />
  if (t === 'video')    return <Video className="w-3.5 h-3.5" />
  if (t === 'document') return <FileText className="w-3.5 h-3.5" />
  return null
}

/** Counts {{n}} placeholders in the body */
function countVars(body: string): number {
  const matches = body.match(/\{\{\d+\}\}/g)
  return matches ? new Set(matches.map(m => m.replace(/\D/g, ''))).size : 0
}

/** Highlights {{n}} in body preview */
function BodyPreview({ text }: { text: string }) {
  const parts = text.split(/(\{\{\d+\}\})/)
  return (
    <span>
      {parts.map((p, i) =>
        /^\{\{\d+\}\}$/.test(p)
          ? <span key={i} className="inline-block rounded bg-emerald-100 text-emerald-700 text-[11px] font-mono px-1 mx-0.5">{p}</span>
          : <span key={i}>{p}</span>
      )}
    </span>
  )
}

// ── Template dialog ───────────────────────────────────────────────────────────

const BLANK: Omit<WaTemplatePayload, 'organization_id'> = {
  name: '', display_name: '', category: 'UTILITY', language: 'pt_BR',
  header_type: 'none', header_text: null, header_media_url: null,
  body_text: '', variable_names: null, footer_text: null, status: 'local',
}

interface DialogProps {
  orgSlug: string
  open: boolean
  editing: WaTemplate | null
  onClose: () => void
  onSaved: (t: WaTemplate) => void
}

function TemplateDialog({ orgSlug, open, editing, onClose, onSaved }: DialogProps) {
  const [form, setForm] = useState<WaTemplatePayload>(editing ?? { ...BLANK })
  const [varLabels, setVarLabels] = useState<string[]>(editing?.variable_names ?? [])
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  // Sync when editing target changes
  const prevEditing = useRef<WaTemplate | null>(null)
  if (editing !== prevEditing.current) {
    prevEditing.current = editing
    const base = editing ?? { ...BLANK }
    setForm(base)
    setVarLabels(base.variable_names ?? [])
  }

  const varCount = countVars(form.body_text)

  function patch(u: Partial<WaTemplatePayload>) {
    setForm(prev => ({ ...prev, ...u }))
  }

  function handleVarCountChange(newBody: string) {
    const n = countVars(newBody)
    setVarLabels(prev => {
      const next = [...prev]
      while (next.length < n) next.push('')
      return next.slice(0, n)
    })
    patch({ body_text: newBody })
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const url = await uploadWaMedia(orgSlug, fd)
      patch({ header_media_url: url })
      toast.success('Arquivo enviado!')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function handleSubmit() {
    if (!form.name.trim())         return toast.error('Informe o nome do template (nome Meta)')
    if (!form.display_name.trim()) return toast.error('Informe um nome de exibição')
    if (!form.body_text.trim())    return toast.error('O corpo do template é obrigatório')
    if (form.header_type !== 'none' && form.header_type !== 'text' && !form.header_media_url?.trim())
      return toast.error('Adicione a URL ou faça upload da mídia do cabeçalho')

    const payload: WaTemplatePayload = {
      ...form,
      name: form.name.trim().toLowerCase().replace(/\s+/g, '_'),
      display_name: form.display_name.trim(),
      variable_names: varLabels.length > 0 ? varLabels : null,
      header_text:      form.header_type === 'text' ? (form.header_text ?? null) : null,
      header_media_url: ['image','video','document'].includes(form.header_type) ? (form.header_media_url ?? null) : null,
    }

    startTransition(async () => {
      try {
        if (editing) {
          await updateWaTemplate(orgSlug, editing.id, payload)
          onSaved({ ...editing, ...payload })
          toast.success('Template atualizado!')
        } else {
          const created = await createWaTemplate(orgSlug, payload)
          onSaved(created)
          toast.success('Template criado!')
        }
        onClose()
      } catch (err: any) {
        toast.error(err.message)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar template' : 'Novo template HSM'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">

          {/* Names row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="wa-display">Nome de exibição</Label>
              <Input id="wa-display" placeholder="Boas-vindas" value={form.display_name}
                onChange={e => patch({ display_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-name">
                Nome Meta <span className="text-[11px] text-muted-foreground font-normal">(exato, snake_case)</span>
              </Label>
              <Input id="wa-name" placeholder="boas_vindas_v1" value={form.name}
                onChange={e => patch({ name: e.target.value.toLowerCase().replace(/\s+/g, '_') })} />
            </div>
          </div>

          {/* Category / Language / Status */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={v => patch({ category: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTILITY">Utilidade</SelectItem>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Idioma</Label>
              <Select value={form.language} onValueChange={v => patch({ language: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt_BR">Português (BR)</SelectItem>
                  <SelectItem value="en_US">English (US)</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status Meta</Label>
              <Select value={form.status} onValueChange={v => patch({ status: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Local (rascunho)</SelectItem>
                  <SelectItem value="pending">Pendente aprovação</SelectItem>
                  <SelectItem value="approved">Aprovado ✓</SelectItem>
                  <SelectItem value="rejected">Rejeitado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Header */}
          <div className="space-y-3 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Cabeçalho</Label>
              <Select value={form.header_type} onValueChange={v => patch({ header_type: v as any, header_text: null, header_media_url: null })}>
                <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem cabeçalho</SelectItem>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="image">Imagem</SelectItem>
                  <SelectItem value="video">Vídeo</SelectItem>
                  <SelectItem value="document">Documento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.header_type === 'text' && (
              <Input placeholder="Texto do cabeçalho" value={form.header_text ?? ''}
                onChange={e => patch({ header_text: e.target.value })} />
            )}

            {['image', 'video', 'document'].includes(form.header_type) && (
              <div className="space-y-2">
                {/* Preview if URL exists */}
                {form.header_media_url && (
                  <div className="relative rounded-xl overflow-hidden border border-border bg-muted">
                    {form.header_type === 'image' ? (
                      <img src={form.header_media_url} alt="header" className="w-full max-h-40 object-cover" />
                    ) : (
                      <div className="flex items-center gap-3 p-3">
                        {form.header_type === 'video' ? <Video className="w-8 h-8 text-muted-foreground" /> : <FileText className="w-8 h-8 text-muted-foreground" />}
                        <a href={form.header_media_url} target="_blank" className="text-sm text-primary flex items-center gap-1 hover:underline">
                          Ver arquivo <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                    <button
                      onClick={() => patch({ header_media_url: null })}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Upload + URL */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder={`URL pública da ${form.header_type === 'image' ? 'imagem' : form.header_type === 'video' ? 'vídeo' : 'documento'}`}
                      value={form.header_media_url ?? ''}
                      onChange={e => patch({ header_media_url: e.target.value })}
                    />
                  </div>
                  <Button type="button" variant="outline" size="sm" className="shrink-0"
                    onClick={() => fileRef.current?.click()} disabled={uploading}>
                    <Upload className="w-4 h-4 mr-1.5" />
                    {uploading ? 'Enviando...' : 'Upload'}
                  </Button>
                  <input ref={fileRef} type="file" className="hidden"
                    accept={form.header_type === 'image' ? 'image/*' : form.header_type === 'video' ? 'video/*' : '.pdf'}
                    onChange={handleFileUpload} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {form.header_type === 'image' && 'Formatos: PNG, JPG, WEBP · Máx 5 MB'}
                  {form.header_type === 'video' && 'Formatos: MP4, 3GP · Máx 16 MB'}
                  {form.header_type === 'document' && 'Formato: PDF · Máx 100 MB'}
                </p>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="wa-body">Corpo da mensagem <span className="text-red-500">*</span></Label>
              <span className="text-xs text-muted-foreground">Use {'{{1}}'}, {'{{2}}'} para variáveis</span>
            </div>
            <Textarea
              id="wa-body"
              rows={4}
              placeholder="Olá, {{1}}! Seu pedido {{2}} foi confirmado. 😊"
              value={form.body_text}
              onChange={e => handleVarCountChange(e.target.value)}
            />
            {varCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {varCount} variável{varCount > 1 ? 'is' : ''} detectada{varCount > 1 ? 's' : ''}. Preencha os nomes abaixo para identificá-las nas automações.
              </p>
            )}
          </div>

          {/* Variable labels */}
          {varCount > 0 && (
            <div className="space-y-2 rounded-xl border border-border p-4">
              <Label className="text-sm font-semibold">Nome das variáveis</Label>
              <div className="space-y-2">
                {Array.from({ length: varCount }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-mono rounded bg-muted px-2 py-1 shrink-0 text-muted-foreground">{`{{${i + 1}}}`}</span>
                    <Input
                      placeholder={`ex: nome do cliente`}
                      value={varLabels[i] ?? ''}
                      onChange={e => {
                        const next = [...varLabels]
                        next[i] = e.target.value
                        setVarLabels(next)
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="space-y-1.5">
            <Label htmlFor="wa-footer">
              Rodapé <span className="text-muted-foreground font-normal text-[11px]">(opcional)</span>
            </Label>
            <Input id="wa-footer" placeholder="Althos CRM · Responda PARAR para cancelar"
              value={form.footer_text ?? ''} onChange={e => patch({ footer_text: e.target.value || null })} />
          </div>

          {/* Live preview */}
          <div className="rounded-xl border border-emerald-100 bg-[#ECF8F0] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 mb-3">Pré-visualização</p>
            <div className="bg-white rounded-2xl rounded-tl-none shadow-sm max-w-xs p-3 space-y-1.5">
              {form.header_type === 'image' && form.header_media_url && (
                <img src={form.header_media_url} alt="header" className="rounded-xl w-full h-28 object-cover" />
              )}
              {form.header_type === 'image' && !form.header_media_url && (
                <div className="rounded-xl w-full h-20 bg-muted flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              {form.header_type === 'text' && form.header_text && (
                <p className="text-sm font-bold text-foreground">{form.header_text}</p>
              )}
              {form.body_text && (
                <p className="text-sm text-foreground leading-relaxed">
                  <BodyPreview text={form.body_text} />
                </p>
              )}
              {form.footer_text && (
                <p className="text-[11px] text-muted-foreground">{form.footer_text}</p>
              )}
            </div>
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={pending || uploading}>
            {pending ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function WaTemplatesClient({ orgSlug, initialTemplates }: {
  orgSlug: string
  initialTemplates: WaTemplate[]
}) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing]      = useState<WaTemplate | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [, startTransition]        = useTransition()
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null)

  function openNew()            { setEditing(null); setDialogOpen(true) }
  function openEdit(t: WaTemplate) { setEditing(t);   setDialogOpen(true) }
  function closeDialog()        { setDialogOpen(false); setEditing(null)  }

  function handleSaved(t: WaTemplate) {
    setTemplates(prev => {
      const idx = prev.findIndex(x => x.id === t.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = t; return n }
      return [t, ...prev]
    })
  }

  function handleDelete(id: string) {
    setDeletingId(id)
    startTransition(async () => {
      try {
        await deleteWaTemplate(orgSlug, id)
        setTemplates(prev => prev.filter(t => t.id !== id))
        toast.success('Template removido')
      } catch (err: any) {
        toast.error(err.message)
      } finally {
        setDeletingId(null)
      }
    })
  }

  return (
    <div className="max-w-4xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Templates WhatsApp (HSM)</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie seus templates aprovados pela Meta. Usados em automações para enviar mensagens fora da janela de 24h.
          </p>
        </div>
        <Button onClick={openNew} size="sm" className="shrink-0">
          <Plus className="w-4 h-4 mr-1.5" />
          Novo template
        </Button>
      </div>

      {/* Info callout */}
      <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-800 flex gap-3">
        <span className="text-lg shrink-0">⚠️</span>
        <div>
          <strong>Templates precisam ser aprovados pela Meta antes de serem enviados.</strong>
          {' '}Crie e submeta seus templates no{' '}
          <a href="https://business.facebook.com/wa/manage/message-templates/" target="_blank"
            className="underline hover:text-amber-900">Meta Business Manager</a>.
          {' '}Após aprovação, registre o nome exato aqui e selecione-o nas automações.
        </div>
      </div>

      {/* Template list */}
      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <div className="text-4xl mb-4">💬</div>
          <h3 className="text-base font-semibold mb-1">Nenhum template cadastrado</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
            Cadastre seus templates HSM aprovados para usá-los nas automações.
          </p>
          <Button onClick={openNew} size="sm"><Plus className="w-4 h-4 mr-1.5" /> Criar primeiro template</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(t => (
            <div key={t.id} className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-4 p-4">

                {/* Header media preview */}
                {t.header_type === 'image' && t.header_media_url ? (
                  <img src={t.header_media_url} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0 border border-border" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center shrink-0 border border-border">
                    {t.header_type === 'image'    && <ImageIcon className="w-6 h-6 text-muted-foreground" />}
                    {t.header_type === 'video'    && <Video className="w-6 h-6 text-muted-foreground" />}
                    {t.header_type === 'document' && <FileText className="w-6 h-6 text-muted-foreground" />}
                    {(t.header_type === 'none' || t.header_type === 'text') && <span className="text-2xl">💬</span>}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-foreground">{t.display_name}</p>
                    <Badge variant="outline" className={`text-[10px] font-semibold ${categoryColor(t.category)}`}>
                      {t.category}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] font-semibold ${statusColor(t.status)}`}>
                      {statusLabel(t.status)}
                    </Badge>
                    {t.header_type !== 'none' && (
                      <Badge variant="outline" className="text-[10px] font-semibold gap-1 bg-gray-50 text-gray-600">
                        {headerIcon(t.header_type)}
                        {t.header_type === 'image' ? 'Imagem' : t.header_type === 'video' ? 'Vídeo' : 'Documento'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs font-mono text-muted-foreground mb-2">{t.name}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    <BodyPreview text={t.body_text} />
                  </p>
                  {t.variable_names && t.variable_names.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {t.variable_names.map((v, i) => (
                        <span key={i} className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground font-mono">
                          {`{{${i + 1}}}`} {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground"
                    onClick={() => openEdit(t)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setTemplateToDelete(t.id)} disabled={deletingId === t.id}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateDialog
        orgSlug={orgSlug}
        open={dialogOpen}
        editing={editing}
        onClose={closeDialog}
        onSaved={handleSaved}
      />

      <AlertDialog open={!!templateToDelete} onOpenChange={o => !o && setTemplateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover template?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleDelete(templateToDelete!); setTemplateToDelete(null) }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
