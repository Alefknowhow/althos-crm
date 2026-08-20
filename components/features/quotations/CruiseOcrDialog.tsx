'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Upload, Loader2, Sparkles, Ship, ClipboardPaste, FileText, ImageIcon } from 'lucide-react'
import { extractCruiseScreenshot } from '@/actions/document-extract'
import type { ExtractedCruise } from '@/lib/ai/cruise-ocr-extract'

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

/**
 * "Ler com IA" pro bloco Cruzeiro — aceita print/PDF (upload ou Ctrl+V) OU
 * texto colado (orçamento recebido por e-mail/WhatsApp), sempre via Gemini
 * Flash (extractCruiseScreenshot). Mostra o resultado extraído pra revisão
 * antes de aplicar — o usuário confirma, nunca é salvo automaticamente.
 */
export default function CruiseOcrDialog({
  orgSlug, open, onOpenChange, onApply,
}: {
  orgSlug: string
  open: boolean
  onOpenChange: (o: boolean) => void
  onApply: (data: ExtractedCruise) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'file' | 'text'>('file')
  const [file, setFile] = useState<File | null>(null)
  const [pastedText, setPastedText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [result, setResult] = useState<ExtractedCruise | null>(null)

  function reset() {
    setFile(null); setPastedText(''); setExtracting(false); setResult(null); setMode('file')
    if (fileRef.current) fileRef.current.value = ''
  }

  useEffect(() => {
    if (!open || file || mode !== 'file') return
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
  }, [open, file, mode])

  async function handleFile(f: File) {
    if (!ACCEPTED_MIME[f.type]) { toast.error('Formato não suportado. Use PDF, JPG, PNG, WebP ou GIF.'); return }
    if (f.size > 15 * 1024 * 1024) { toast.error('Arquivo muito grande. O limite é 15 MB.'); return }
    setFile(f)
    setExtracting(true)
    try {
      const base64 = await fileToBase64(f)
      const res = await extractCruiseScreenshot(orgSlug, { base64, mediaType: f.type })
      if (!res.ok) { toast.error(res.error); setFile(null); return }
      setResult(res.data)
    } catch (e: any) {
      toast.error('Não foi possível processar o arquivo. Tente novamente.', { description: e?.message })
      setFile(null)
    } finally {
      setExtracting(false)
    }
  }

  async function handleExtractText() {
    if (!pastedText.trim()) { toast.error('Cole o texto do orçamento.'); return }
    setExtracting(true)
    try {
      const res = await extractCruiseScreenshot(orgSlug, { text: pastedText })
      if (!res.ok) { toast.error(res.error); return }
      setResult(res.data)
    } catch (e: any) {
      toast.error('Não foi possível processar o texto. Tente novamente.', { description: e?.message })
    } finally {
      setExtracting(false)
    }
  }

  function handleApply() {
    if (!result) return
    onApply(result)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Ler cruzeiro com IA</DialogTitle>
          <DialogDescription>Envie um print/PDF da cotação ou cole o texto do orçamento — a IA preenche os campos automaticamente.</DialogDescription>
        </DialogHeader>

        {!result && !extracting && (
          <div className="flex gap-1.5 border-b pb-2">
            <button type="button" onClick={() => setMode('file')}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-medium ${mode === 'file' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              <ImageIcon className="w-3.5 h-3.5" /> Print / PDF
            </button>
            <button type="button" onClick={() => setMode('text')}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-medium ${mode === 'text' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              <FileText className="w-3.5 h-3.5" /> Colar texto
            </button>
          </div>
        )}

        {!result && !extracting && mode === 'file' && !file && (
          <div className="space-y-2">
            <label className="block border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,application/pdf,image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
              <Upload className="w-7 h-7 mx-auto text-muted-foreground mb-2" />
              <p className="font-medium text-sm mb-1">Clique para enviar o arquivo</p>
              <p className="text-xs text-muted-foreground">PDF ou imagem, até 15 MB — ou cole com Ctrl+V</p>
            </label>
            <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1"><ClipboardPaste className="w-3 h-3" /> Ctrl+V também funciona aqui</p>
          </div>
        )}

        {!result && !extracting && mode === 'text' && (
          <div className="space-y-2">
            <Textarea rows={8} placeholder="Cole aqui o texto do orçamento recebido por e-mail/WhatsApp…" value={pastedText} onChange={e => setPastedText(e.target.value)} />
            <Button type="button" className="w-full" onClick={handleExtractText}>
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Ler com IA
            </Button>
          </div>
        )}

        {extracting && (
          <div className="py-10 flex flex-col items-center justify-center gap-3 text-muted-foreground text-sm">
            <Loader2 className="w-6 h-6 animate-spin" />
            Lendo com IA…
          </div>
        )}

        {result && (
          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1 text-xs">
            <div className="rounded-lg border p-2.5 space-y-1">
              <p className="font-medium flex items-center gap-1.5"><Ship className="w-3.5 h-3.5 text-muted-foreground" /> {result.ship_name || result.cruise_line || 'Cruzeiro'}</p>
              <p className="text-muted-foreground">
                {[result.itinerary_name, result.duration_nights ? `${result.duration_nights} noites` : null].filter(Boolean).join(' · ') || '—'}
              </p>
              <p className="text-muted-foreground">
                {result.embark_port ? `Embarque ${result.embark_port}${result.embark_date ? ` (${result.embark_date})` : ''}` : ''}
                {result.disembark_port ? ` · Desembarque ${result.disembark_port}${result.disembark_date ? ` (${result.disembark_date})` : ''}` : ''}
              </p>
              {result.cabin_category && <p className="text-muted-foreground">Cabine: {result.cabin_category}{result.cabin_type ? ` (${result.cabin_type})` : ''}</p>}
              {result.total_cents != null && <p className="text-muted-foreground">Total: {(result.total_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>}
              {result.days.length > 0 && <p className="text-muted-foreground">Itinerário: {result.days.length} dias identificados</p>}
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">Revise os dados acima — depois de aplicar, eles preenchem os campos do cruzeiro, ainda editáveis.</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {(file || result) && !extracting && (
            <Button variant="outline" onClick={reset}>Trocar</Button>
          )}
          {result && (
            <Button onClick={handleApply}>Aplicar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
