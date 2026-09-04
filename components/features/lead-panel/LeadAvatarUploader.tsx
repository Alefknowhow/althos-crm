'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ImagePlus, Loader2 } from 'lucide-react'
import { uploadContatoAvatar } from '@/actions/contatos'

function initials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (name || '?').slice(0, 2).toUpperCase()
}

/** Uploader de foto do lead, reaproveitando o pipeline de avatar já usado em
 *  Contatos (uploadContatoAvatar/removeContatoAvatar, ver actions/contatos.ts).
 *  Compartilhado entre o painel do WhatsApp e o do Instagram — pra WhatsApp
 *  é sempre upload manual (a Meta não expõe foto de perfil nessa API), pra
 *  Instagram o lead já pode nascer com uma foto (copiada de sender_avatar_url
 *  na criação), mas o atendente pode trocar por uma manual aqui do mesmo jeito.
 *  Split out of LeadDataTab.tsx. */
export function LeadAvatarUploader({
  orgSlug, contatoId, name, url,
}: {
  orgSlug: string
  contatoId: string
  name: string
  url: string | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadContatoAvatar(orgSlug, contatoId, fd)
    setBusy(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Foto atualizada.')
  }

  return (
    <div className="relative shrink-0 group">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-14 w-14 rounded-full object-cover border" />
      ) : (
        <div className="h-14 w-14 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center text-sm border">
          {initials(name)}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={onFile} />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 shadow disabled:opacity-50"
        title="Trocar foto"
        aria-label="Trocar foto"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
      </button>
    </div>
  )
}
