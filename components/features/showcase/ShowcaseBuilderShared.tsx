'use client'

/**
 * Shared small UI helpers used across ShowcaseBuilder's sections. Split
 * out of ShowcaseBuilder.tsx.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { uploadFormAsset } from '@/actions/upload'
import { toast } from 'sonner'
import { Trash2, Plus, Upload, Loader2 } from 'lucide-react'

// ── money helpers (reais string <-> cents) ─────────────────────────────
function centsToReais(c?: number | null) {
  return c ? String((c / 100).toFixed(2)).replace('.', ',') : ''
}
function reaisToCents(s: string) {
  const n = parseFloat((s || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export function MoneyInput({
  value, onChange, placeholder = 'R$ 0,00',
}: { value: number; onChange: (cents: number) => void; placeholder?: string }) {
  const [text, setText] = useState(centsToReais(value))
  return (
    <Input
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onChange={e => { setText(e.target.value); onChange(reaisToCents(e.target.value)) }}
    />
  )
}

export function SectionCard({
  icon: Icon, title, action, children,
}: { icon: any; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <div className="flex flex-row items-center justify-between gap-2 px-6 pt-6 pb-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Icon className="w-4 h-4 text-primary" /> {title}
        </h3>
        {action}
      </div>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

export function StringList({
  items, onChange, placeholder,
}: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={it}
            placeholder={placeholder}
            onChange={e => { const next = [...items]; next[i] = e.target.value; onChange(next) }}
          />
          <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10"
            onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, ''])}>
        <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar item
      </Button>
    </div>
  )
}

export const PAYMENT_METHODS = [
  { key: 'pix', label: 'Pix' },
  { key: 'boleto', label: 'Boleto' },
  { key: 'cartao', label: 'Cartão' },
]

export function PhotoManager({
  orgSlug, label, photos, onChange,
}: { orgSlug: string; label: string; photos: string[]; onChange: (v: string[]) => void }) {
  const [uploading, setUploading] = useState(false)
  const [url, setUrl] = useState('')

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const added: string[] = []
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadFormAsset(orgSlug, fd)
      if (res.ok) added.push(res.url)
      else toast.error(res.error || 'Falha no upload')
    }
    setUploading(false)
    if (added.length) onChange([...photos, ...added])
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((src, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-20 w-full object-cover rounded-md border" />
              <button
                type="button"
                onClick={() => onChange(photos.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? 'Enviando…' : 'Enviar fotos'}
          <input type="file" accept="image/*" multiple className="hidden" disabled={uploading}
            onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
        </label>
        <div className="flex gap-2 flex-1 min-w-[200px]">
          <Input placeholder="ou cole uma URL de imagem" value={url} onChange={e => setUrl(e.target.value)} />
          <Button type="button" variant="outline" size="sm"
            onClick={() => { const u = url.trim(); if (u) { onChange([...photos, u]); setUrl('') } }}>
            Adicionar
          </Button>
        </div>
      </div>
    </div>
  )
}
