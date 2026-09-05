'use client'

/**
 * New/edit template dialog for WaTemplatesClient. Split out of
 * WaTemplatesClient.tsx.
 */

import { useState, useTransition, useRef } from 'react'
import {
  createWaTemplate, updateWaTemplate, uploadWaMedia,
  type WaTemplate, type WaTemplatePayload,
} from '@/actions/whatsapp-templates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ImageIcon, FileText, Video, X, Upload, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { countVars, BodyPreview } from './WaTemplatesShared'

const BLANK: Omit<WaTemplatePayload, 'organization_id'> = {
  name: '', display_name: '', category: 'UTILITY', language: 'pt_BR',
  header_type: 'none', header_text: null, header_media_url: null, header_storage_object_id: null,
  body_text: '', variable_names: null, footer_text: null, status: 'local',
}

interface DialogProps {
  orgSlug: string
  open: boolean
  editing: WaTemplate | null
  onClose: () => void
  onSaved: (t: WaTemplate) => void
}

export function TemplateDialog({ orgSlug, open, editing, onClose, onSaved }: DialogProps) {
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
      const { url, objectId } = await uploadWaMedia(orgSlug, fd)
      patch({ header_media_url: url, header_storage_object_id: objectId })
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
      header_storage_object_id: ['image','video','document'].includes(form.header_type) ? (form.header_storage_object_id ?? null) : null,
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

          {/* Category / Language */}
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* Header */}
          <div className="space-y-3 rounded-none border border-border p-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Cabeçalho</Label>
              <Select value={form.header_type} onValueChange={v => patch({ header_type: v as any, header_text: null, header_media_url: null, header_storage_object_id: null })}>
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
                  <div className="relative rounded-none overflow-hidden border border-border bg-muted">
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
                      onClick={() => patch({ header_media_url: null, header_storage_object_id: null })}
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
                      onChange={e => patch({ header_media_url: e.target.value, header_storage_object_id: null })}
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
            <div className="space-y-2 rounded-none border border-border p-4">
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
          <div className="rounded-none border border-emerald-100 bg-[#ECF8F0] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 mb-3">Pré-visualização</p>
            <div className="bg-white rounded-none rounded-tl-none   max-w-xs p-3 space-y-1.5">
              {form.header_type === 'image' && form.header_media_url && (
                <img src={form.header_media_url} alt="header" className="rounded-none w-full h-28 object-cover" />
              )}
              {form.header_type === 'image' && !form.header_media_url && (
                <div className="rounded-none w-full h-20 bg-muted flex items-center justify-center">
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
