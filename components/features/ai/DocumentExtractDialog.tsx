'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Upload, Loader2, Sparkles, Plane, FileIcon, ImageIcon, ClipboardPaste } from 'lucide-react'
import { extractTravelDocument } from '@/actions/document-extract'
import type { ExtractedTravelDocument } from '@/lib/ai/document-extract'

const ACCEPTED_MIME: Record<string, string> = {
  'application/pdf': 'application/pdf', 'image/jpeg': 'image/jpeg', 'image/png': 'image/png',
  'image/webp': 'image/webp', 'image/gif': 'image/gif',
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export default function DocumentExtractDialog({
  orgSlug, open, onOpenChange, title, description, onApply,
}: {
  orgSlug: string
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  description: string
  onApply: (data: ExtractedTravelDocument, file: File) => void | Promise<void>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedTravelDocument | null>(null)

  function reset() {
    setFile(null); setExtracting(false); setExtracted(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  // Permite colar um print direto da área de transferência (Ctrl+V) enquanto
  // o dialog está aberto e nenhum arquivo foi selecionado ainda.
  useEffect(() => {
    if (!open || file) return
    function onWindowPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'))
      if (!item) return
      const blob = item.getAsFile()
      if (!blob) return
      e.preventDefault()
      const ext = item.type.split('/')[1] || 'png'
      handleFile(new File([blob], `colado.${ext}`, { type: item.type }))
    }
    window.addEventListener('paste', onWindowPaste)
    return () => window.removeEventListener('paste', onWindowPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file])

  async function handlePasteButton() {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find(t => t.startsWith('image/'))
        if (!type) continue
        const blob = await item.getType(type)
        const ext = type.split('/')[1] || 'png'
        handleFile(new File([blob], `colado.${ext}`, { type }))
        return
      }
      toast.error('Nenhuma imagem encontrada na área de transferência')
    } catch {
      toast.error('Não foi possível acessar a área de transferência — tente Ctrl+V')
    }
  }

  async function handleFile(f: File) {
    if (!ACCEPTED_MIME[f.type]) { toast.error('Formato não suportado. Use PDF, JPG, PNG, WebP ou GIF.'); return }
    if (f.size > 15 * 1024 * 1024) { toast.error('Arquivo muito grande. O limite é 15 MB.'); return }

    setFile(f)
    setExtracting(true)
    const base64 = await fileToBase64(f)
    const res = await extractTravelDocument(orgSlug, { base64, mediaType: f.type })
    setExtracting(false)

    if (!res.ok) { toast.error(res.error); return }
    setExtracted(res.data)
  }

  function set<K extends keyof ExtractedTravelDocument>(k: K, v: ExtractedTravelDocument[K]) {
    setExtracted(prev => prev ? { ...prev, [k]: v } : prev)
  }

  function handleApply() {
    if (!extracted || !file) return
    onApply(extracted, file)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> {title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!file ? (
          <div className="space-y-2">
            <label className="block border-2 border-dashed border-border rounded-none p-10 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,application/pdf,image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium mb-1">Clique para enviar o arquivo</p>
              <p className="text-xs text-muted-foreground">PDF ou imagem, até 15 MB — ou cole um print com Ctrl+V</p>
            </label>
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={handlePasteButton}>
              <ClipboardPaste className="w-3.5 h-3.5 mr-1.5" /> Colar da área de transferência
            </Button>
          </div>
        ) : extracting ? (
          <div className="py-10 flex flex-col items-center justify-center gap-3 text-muted-foreground text-sm">
            <Loader2 className="w-6 h-6 animate-spin" />
            Lendo o documento com IA…
          </div>
        ) : extracted ? (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5 text-xs">
              {file.type === 'application/pdf' ? <FileIcon className="w-4 h-4 text-rose-500 shrink-0" /> : <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />}
              <span className="truncate">{file.name}</span>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Cliente</Label>
                <Input value={extracted.cliente || ''} onChange={e => set('cliente', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Destino</Label>
                <Input value={extracted.destino || ''} onChange={e => set('destino', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Hotel</Label>
                <Input value={extracted.hotel || ''} onChange={e => set('hotel', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Operadora</Label>
                <Input value={extracted.operadora || ''} onChange={e => set('operadora', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Localizador do pacote</Label>
                <Input value={extracted.localizador_pacote || ''} onChange={e => set('localizador_pacote', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Localizador aéreo</Label>
                <Input value={extracted.localizador_aereo || ''} onChange={e => set('localizador_aereo', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data de ida</Label>
                <Input type="date" value={extracted.data_ida || ''} onChange={e => set('data_ida', e.target.value || null)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data de volta</Label>
                <Input type="date" value={extracted.data_volta || ''} onChange={e => set('data_volta', e.target.value || null)} />
              </div>
            </div>

            {extracted.voos.length > 0 && (
              <div className="rounded-lg border bg-muted/20 p-2.5 space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Plane className="w-3 h-3" /> Voos identificados
                </p>
                {extracted.voos.map((v, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    {v.companhia || 'Cia não identificada'} · {v.origem || '?'} → {v.destino || '?'} {v.data ? `· ${v.data}` : ''}
                  </p>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => set('traslado', !extracted.traslado)}
                className={`px-3 h-8 rounded-lg border text-xs font-medium transition-colors ${extracted.traslado ? 'bg-success/15 text-success border-success/30' : 'bg-background text-muted-foreground border-border'}`}
              >
                Traslado {extracted.traslado ? 'incluso' : 'não incluso'}
              </button>
              <button
                type="button"
                onClick={() => set('seguro', !extracted.seguro)}
                className={`px-3 h-8 rounded-lg border text-xs font-medium transition-colors ${extracted.seguro ? 'bg-success/15 text-success border-success/30' : 'bg-background text-muted-foreground border-border'}`}
              >
                Seguro {extracted.seguro ? 'incluso' : 'não incluso'}
              </button>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Textarea rows={2} value={extracted.observacoes || ''} onChange={e => set('observacoes', e.target.value || null)} />
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {file && !extracting && (
            <Button variant="outline" onClick={reset}>Trocar arquivo</Button>
          )}
          {extracted && (
            <Button onClick={handleApply}>Aplicar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
