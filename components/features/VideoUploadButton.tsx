'use client'

import { useRef, useState } from 'react'
import { uploadFormVideo } from '@/actions/upload'
import { VideoIcon, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  orgSlug: string
  value?: string
  onChange: (url: string | undefined) => void
  className?: string
}

/** Mesmo padrão do ImageUploadButton, mas pra vídeo de pergunta — ocupa o
 *  topo da tela quando presente (ver EditableFieldCard/PublicFormPreview). */
export default function VideoUploadButton({ orgSlug, value, onChange, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErr(null)
    setBusy(true)

    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadFormVideo(orgSlug, fd)

    setBusy(false)
    e.target.value = ''

    if (res.ok) onChange(res.url)
    else setErr(res.error)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={handleFile}
      />

      {value ? (
        <div className="relative group rounded-lg overflow-hidden border">
          <video src={value} className="w-full max-h-40 object-cover" muted />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remover vídeo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 px-3 py-4 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
        >
          {busy
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
            : <><VideoIcon className="w-4 h-4" /> Enviar vídeo</>
          }
        </button>
      )}

      {err && <p className="text-[10px] text-destructive">{err}</p>}
      <p className="text-[10px] text-muted-foreground">MP4, WebM ou MOV · máx 30 MB</p>
    </div>
  )
}
