'use client'

/**
 * Media-upload widgets for the Quotation editor: single cover image
 * (with drag/paste/Unsplash search), a small avatar-style signature
 * photo upload, the Unsplash search dialog, and a multi-photo gallery
 * with reordering. Split out of QuotationEditorFields.tsx.
 */

import { useCallback, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Plus, Trash2, Upload, Loader2, Image as ImageIcon, Search, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { unsplashSearch, unsplashTrackDownload } from '@/actions/quotations'
import { compressAndUpload } from './QuotationEditorFields'
import { BAGGAGE_OPTIONS } from './PublicQuotationView'

/* ═════════════ upload de imagem (única) com colar/arrastar ═════════════ */
export function CoverUpload({
  orgSlug, url, onChange, unsplashHint, compact = false,
}: { orgSlug: string; url?: string | null; onChange: (u: string | null) => void; unsplashHint?: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const handle = useCallback(async (file?: File | null) => {
    if (!file || !file.type.startsWith('image/')) return
    setBusy(true)
    const u = await compressAndUpload(orgSlug, file)
    setBusy(false)
    if (u) onChange(u)
  }, [orgSlug, onChange])
  return (
    <div className="space-y-2">
      <div
        className={cn('relative border-2 border-dashed rounded-lg overflow-hidden bg-muted/30 aspect-video flex items-center justify-center text-center', compact && 'text-xs')}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handle(e.dataTransfer.files?.[0]) }}
        onPaste={e => { const f = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'))?.getAsFile(); if (f) { e.preventDefault(); handle(f) } }}
        tabIndex={0}
      >
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => handle(e.target.files?.[0])} />
        {url ? (
          <>
            {/* Mostra a imagem inteira (object-contain), não recortada — a
                proporção padrão da capa é 16:9. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Capa" className="w-full h-full object-contain" />
            <div className={cn('absolute flex gap-1', compact ? 'bottom-1 right-1' : 'bottom-2 right-2 gap-2')}>
              <Button type="button" size={compact ? 'icon' : 'sm'} variant="secondary" className={compact ? 'w-6 h-6' : undefined} onClick={() => inputRef.current?.click()} disabled={busy}>
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              </Button>
              <Button type="button" size={compact ? 'icon' : 'sm'} variant="destructive" className={compact ? 'w-6 h-6' : undefined} onClick={() => onChange(null)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          </>
        ) : (
          <button type="button" className={cn('text-muted-foreground w-full', compact ? 'p-2' : 'p-6 text-sm')} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className={cn('animate-spin mx-auto', compact ? 'w-4 h-4' : 'w-5 h-5')} /> : (
              compact
                ? <><ImageIcon className="w-4 h-4 mx-auto mb-1" />Capa</>
                : <><ImageIcon className="w-6 h-6 mx-auto mb-2" />Clique, cole (Ctrl+V) ou arraste a imagem de capa</>
            )}
          </button>
        )}
      </div>
      <UnsplashPicker orgSlug={orgSlug} hint={unsplashHint} onPick={onChange} />
    </div>
  )
}

/* ═════════════ foto da assinatura (avatar pequeno, upload único) ═════════════ */
export function SignaturePhotoUpload({
  orgSlug, url, onChange,
}: { orgSlug: string; url?: string | null; onChange: (u: string | null) => void }) {
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const handle = useCallback(async (file?: File | null) => {
    if (!file || !file.type.startsWith('image/')) return
    setBusy(true)
    const u = await compressAndUpload(orgSlug, file)
    setBusy(false)
    if (u) onChange(u)
  }, [orgSlug, onChange])
  return (
    <div className="flex items-center gap-2">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => handle(e.target.files?.[0])} />
      <div className="relative w-14 h-14 rounded-full overflow-hidden border bg-muted shrink-0 flex items-center justify-center">
        {url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={url} alt="Foto da assinatura" className="w-full h-full object-cover" />
          : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
      </div>
      <div className="flex flex-col gap-1">
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
          {url ? 'Trocar foto' : 'Enviar foto'}
        </Button>
        {url && <button type="button" className="text-[11px] text-muted-foreground hover:text-destructive text-left" onClick={() => onChange(null)}>Remover foto</button>}
      </div>
    </div>
  )
}

/* ═════════════ busca de foto de capa no Unsplash ═════════════ */
export function UnsplashPicker({
  orgSlug, hint, onPick,
}: { orgSlug: string; hint?: string; onPick: (url: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<{ id: string; thumbUrl: string; fullUrl: string; downloadLocation: string; author: string; authorUrl: string }[] | null>(null)

  async function search(q: string) {
    if (!q.trim()) return
    setBusy(true)
    const res = await unsplashSearch(orgSlug, q)
    setBusy(false)
    if (res.ok) setResults(res.photos)
    else { const { toast } = await import('sonner'); toast.error(res.error) }
  }

  function openPicker() {
    setOpen(true)
    if (!results) { const q = hint || ''; setQuery(q); if (q) search(q) }
  }

  async function pick(p: { fullUrl: string; downloadLocation: string }) {
    onPick(p.fullUrl)
    setOpen(false)
    unsplashTrackDownload(orgSlug, p.downloadLocation)
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={openPicker} className="w-full">
        <Search className="w-3.5 h-3.5 mr-1.5" /> Buscar foto no Unsplash
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Buscar foto no Unsplash</DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5">
            <div className="flex gap-1.5">
              <Input value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); search(query) } }}
                placeholder="Ex.: praia caribe, montanha, cidade europeia…" autoFocus />
              <Button type="button" onClick={() => search(query)} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            {results && results.length > 0 && (
              <div className="grid grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto">
                {results.map(p => (
                  <button key={p.id} type="button" onClick={() => pick(p)}
                    className="relative rounded-lg overflow-hidden aspect-square group border hover:ring-2 hover:ring-primary">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.thumbUrl} alt={p.author} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {results && results.length === 0 && !busy && (
              <p className="text-[11px] text-muted-foreground">Nenhuma foto encontrada. Tente outro termo.</p>
            )}
            <p className="text-[10px] text-muted-foreground">Fotos via Unsplash — atribuição registrada automaticamente.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ═════════════ galeria de fotos (multi) ═════════════ */
export function PhotoGallery({ orgSlug, photos, onChange }: { orgSlug: string; photos: string[]; onChange: (p: string[]) => void }) {
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const addFiles = useCallback(async (files: File[]) => {
    const imgs = files.filter(f => f.type.startsWith('image/'))
    if (!imgs.length) return
    setBusy(true)
    const urls: string[] = []
    for (const f of imgs.slice(0, 8)) {
      const u = await compressAndUpload(orgSlug, f)
      if (u) urls.push(u)
    }
    setBusy(false)
    if (urls.length) onChange([...photos, ...urls])
  }, [orgSlug, photos, onChange])
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= photos.length) return
    const n = [...photos]; const t = n[i]; n[i] = n[j]; n[j] = t
    onChange(n)
  }
  return (
    <div
      className="border-2 border-dashed rounded-lg p-3 bg-muted/20"
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); addFiles(Array.from(e.dataTransfer.files || [])) }}
      onPaste={e => {
        const fs = Array.from(e.clipboardData.items).filter(i => i.type.startsWith('image/')).map(i => i.getAsFile()).filter(Boolean) as File[]
        if (fs.length) { e.preventDefault(); addFiles(fs) }
      }}
      tabIndex={0}
    >
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => addFiles(Array.from(e.target.files || []))} />
      <div className="flex flex-wrap gap-2">
        {photos.map((src, i) => (
          <div key={src + i} className="relative group w-24 h-20 rounded-md overflow-hidden border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
              <button type="button" title="Mover p/ trás" className="text-white/90 hover:text-white" onClick={() => move(i, -1)}><ChevronLeft className="w-4 h-4" /></button>
              <button type="button" title="Remover" className="text-white/90 hover:text-red-300" onClick={() => onChange(photos.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button>
              <button type="button" title="Mover p/ frente" className="text-white/90 hover:text-white" onClick={() => move(i, 1)}><ChevronRight className="w-4 h-4" /></button>
            </div>
            {i === 0 && <span className="absolute top-1 left-1 text-[9px] font-bold uppercase bg-black/60 text-white px-1.5 py-0.5 rounded">capa</span>}
          </div>
        ))}
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-24 h-20 rounded-md border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/40 text-[11px] gap-1">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" />foto</>}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">Cole (Ctrl+V) ou arraste imagens aqui. A 1ª foto é o destaque da galeria.</p>
    </div>
  )
}

/** Seletor de franquias de bagagem: botões só com ícone + resumo textual. */
export function BaggagePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const ICONS: Record<string, React.ReactNode> = {
    item_pessoal: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5M8 10h8" /></svg>,
    mao: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><rect x="6" y="7" width="12" height="14" rx="2" /><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M10 11v6M14 11v6" /></svg>,
    despachada: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><rect x="4" y="6" width="16" height="14" rx="2" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M8 10v6M16 10v6M12 10v6" /></svg>,
  }
  return (
    <div className="flex gap-1">
      {BAGGAGE_OPTIONS.map(o => {
        const on = value.includes(o.key)
        return (
          <button key={o.key} type="button" title={o.label}
            onClick={() => onChange(on ? value.filter(k => k !== o.key) : [...value, o.key])}
            className={`inline-flex items-center justify-center w-9 h-9 rounded-md border transition-colors ${
              on ? 'bg-primary text-primary-foreground border-primary'
                 : 'bg-background text-muted-foreground border-border hover:bg-muted'
            }`}>
            {ICONS[o.key]}
          </button>
        )
      })}
    </div>
  )
}
