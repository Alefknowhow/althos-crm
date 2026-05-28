'use client'

import { useRef, useState } from 'react'
import { uploadFormAsset } from '@/actions/upload'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  orgSlug: string
  value?: string          // current URL (from schema)
  onChange: (url: string | undefined) => void
  previewHeight?: string  // tailwind class e.g. 'max-h-32'
  className?: string
}

export default function ImageUploadButton({
  orgSlug,
  value,
  onChange,
  previewHeight = 'max-h-40',
  className,
}: Props) {
  const inputRef    = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErr(null)
    setBusy(true)

    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadFormAsset(orgSlug, fd)

    setBusy(false)
    // reset so the same file can be re-picked after removal
    e.target.value = ''

    if (res.ok) {
      onChange(res.url)
    } else {
      setErr(res.error)
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={handleFile}
      />

      {value ? (
        /* ── preview + remove ── */
        <div className="relative group rounded-lg overflow-hidden border">
          <img
            src={value}
            alt=""
            className={cn('w-full object-cover', previewHeight)}
          />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remover imagem"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          {/* replace */}
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 bg-black/60 hover:bg-black/80 text-white text-[10px] font-medium rounded-full px-2 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
            Trocar
          </button>
        </div>
      ) : (
        /* ── upload trigger ── */
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 px-3 py-4 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
        >
          {busy
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
            : <><ImagePlus className="w-4 h-4" /> Enviar imagem</>
          }
        </button>
      )}

      {err && (
        <p className="text-[10px] text-destructive">{err}</p>
      )}

      <p className="text-[10px] text-muted-foreground">
        JPG, PNG, WebP, GIF ou SVG · máx 5 MB
      </p>
    </div>
  )
}
