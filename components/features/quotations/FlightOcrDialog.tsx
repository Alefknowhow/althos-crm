'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Upload, Loader2, Sparkles, Plane, ClipboardPaste, X } from 'lucide-react'
import { extractFlightScreenshot } from '@/actions/document-extract'
import type { ExtractedFlightLeg } from '@/lib/ai/flight-ocr-extract'

const ACCEPTED_MIME: Record<string, string> = {
  'application/pdf': 'application/pdf', 'image/jpeg': 'image/jpeg', 'image/png': 'image/png',
  'image/webp': 'image/webp', 'image/gif': 'image/gif',
}

const LEG_LABEL: Record<string, string> = { outbound: 'Ida', inbound: 'Volta', connection: 'Conexão' }

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
 * "Ler com IA" pro bloco Aéreo — cola (Ctrl+V) ou envia um print de
 * bilhete/itinerário e usa Gemini Flash (extractFlightScreenshot, ver
 * actions/document-extract.ts) pra devolver um ou mais trechos
 * estruturados. Aplica como novas linhas em "Trecho" — o usuário revisa/
 * edita normalmente na lista antes de salvar a cotação, igual qualquer
 * trecho digitado à mão.
 */
export default function FlightOcrDialog({
  orgSlug, open, onOpenChange, onApply,
}: {
  orgSlug: string
  open: boolean
  onOpenChange: (o: boolean) => void
  onApply: (legs: ExtractedFlightLeg[]) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [legs, setLegs] = useState<ExtractedFlightLeg[] | null>(null)

  function reset() {
    setFile(null); setExtracting(false); setLegs(null)
    if (fileRef.current) fileRef.current.value = ''
  }

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
    try {
      const base64 = await fileToBase64(f)
      const res = await extractFlightScreenshot(orgSlug, { base64, mediaType: f.type })
      if (!res.ok) { toast.error(res.error); setFile(null); return }
      setLegs(res.data)
    } catch (e: any) {
      toast.error('Não foi possível processar o print. Tente novamente.', { description: e?.message })
      setFile(null)
    } finally {
      setExtracting(false)
    }
  }

  function removeLeg(i: number) {
    setLegs(prev => prev ? prev.filter((_, idx) => idx !== i) : prev)
  }

  function handleApply() {
    if (!legs || legs.length === 0) return
    onApply(legs)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Ler voo com IA</DialogTitle>
          <DialogDescription>Envie ou cole um print do bilhete/itinerário — a IA identifica os trechos automaticamente.</DialogDescription>
        </DialogHeader>

        {!file ? (
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
              <p className="font-medium text-sm mb-1">Clique para enviar o print</p>
              <p className="text-xs text-muted-foreground">PDF ou imagem, até 15 MB — ou cole com Ctrl+V</p>
            </label>
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={handlePasteButton}>
              <ClipboardPaste className="w-3.5 h-3.5 mr-1.5" /> Colar da área de transferência
            </Button>
          </div>
        ) : extracting ? (
          <div className="py-10 flex flex-col items-center justify-center gap-3 text-muted-foreground text-sm">
            <Loader2 className="w-6 h-6 animate-spin" />
            Lendo o print com IA…
          </div>
        ) : legs ? (
          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {legs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum trecho identificado.</p>
            ) : legs.map((leg, i) => (
              <div key={i} className="rounded-lg border p-2.5 text-xs space-y-1 relative">
                <button type="button" onClick={() => removeLeg(i)} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive" aria-label="Remover trecho">
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-1.5 font-medium pr-5">
                  <Plane className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {leg.leg_type ? LEG_LABEL[leg.leg_type] || leg.leg_type : 'Trecho'}
                  {leg.flight_number ? ` · ${leg.flight_number}` : ''}
                </div>
                <p className="text-muted-foreground">
                  {[leg.from_city || leg.from_code, leg.to_city || leg.to_code].filter(Boolean).join(' → ') || '—'}
                  {leg.airline ? ` · ${leg.airline}` : ''}
                </p>
                <p className="text-muted-foreground">
                  {leg.departure_date ? `Partida ${leg.departure_date}${leg.departure_time ? ` ${leg.departure_time}` : ''}` : ''}
                  {leg.arrival_date || leg.arrival_time ? ` · Chegada ${leg.arrival_date || ''}${leg.arrival_time ? ` ${leg.arrival_time}` : ''}` : ''}
                </p>
                {leg.stopover_label && <p className="text-muted-foreground">{leg.stopover_label}</p>}
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground pt-1">Revise os trechos acima — depois de aplicar, cada um vira uma linha editável em &quot;Trecho&quot;.</p>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {file && !extracting && (
            <Button variant="outline" onClick={reset}>Trocar arquivo</Button>
          )}
          {legs && legs.length > 0 && (
            <Button onClick={handleApply}>Aplicar {legs.length > 1 ? `(${legs.length} trechos)` : ''}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
