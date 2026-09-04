'use client'

/**
 * Small dialog/widget components used by ContatosView: quick-action
 * shortcut button, the linked-quotes/reservations dialog, avatar upload,
 * and the new-contato dialog. All prop-driven. Split out of
 * ContatosView.tsx.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Camera, Trash2, Plus } from 'lucide-react'
import { CONTATO_STATUS_META, type ContatoStatus } from '@/lib/contatos'
import { createContato, uploadContatoAvatar, removeContatoAvatar } from '@/actions/contatos'
import { initials, STATUS_VALUES } from './ContatosViewShared'

export { LinkedRecordsDialog, EmptyLinked } from './ContatosViewLinkedRecordsDialog'

export function ShortcutButton({
  label, icon: Icon, onClick, asChild, children,
}: {
  label: string
  icon: any
  onClick?: () => void
  asChild?: boolean
  /** Only used when asChild — should be the navigation element (e.g. a <Link>). */
  children?: React.ReactNode
}) {
  // Plain clickable icon: no label, no border, no background.
  const cls =
    'inline-flex items-center justify-center p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded-md'
  if (asChild) {
    // The child is the link wrapper; render only the icon inside it.
    return (
      <span className={cls} title={label} aria-label={label}>
        {children}
      </span>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls} title={label} aria-label={label}>
      <Icon className="w-4 h-4" />
    </button>
  )
}

// ── Avatar na lista ──────────────────────────────────────────────────
export function ListAvatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="shrink-0 w-9 h-9 rounded-full object-cover" />
  }
  return (
    <span className="shrink-0 w-9 h-9 rounded-full grid place-items-center bg-brand-100 text-brand-700 text-xs font-semibold">
      {initials(name)}
    </span>
  )
}

// ── Painel de detalhe ────────────────────────────────────────────────

export function AvatarUploader({
  orgSlug, contatoId, name, url,
}: {
  orgSlug: string
  contatoId: string
  name: string
  url: string | null
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  // Optimistic local copy: reflects the just-uploaded/removed photo immediately,
  // so the avatar updates even if the server `router.refresh()` data lags or the
  // tab is running a slightly stale bundle. `undefined` = follow the server prop.
  const [localUrl, setLocalUrl] = useState<string | null | undefined>(undefined)

  // When the server prop changes (navigating between contatos), drop the override.
  useEffect(() => { setLocalUrl(undefined) }, [contatoId])

  const shownUrl = localUrl === undefined ? url : localUrl

  async function onFile(file: File) {
    setBusy(true)
    // Show the picked image instantly while the upload runs.
    const preview = URL.createObjectURL(file)
    setLocalUrl(preview)
    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadContatoAvatar(orgSlug, contatoId, fd)
    setBusy(false)
    if (!res.ok) { setLocalUrl(undefined); URL.revokeObjectURL(preview); toast.error(res.error); return }
    setLocalUrl(res.url)
    URL.revokeObjectURL(preview)
    toast.success('Foto atualizada.')
    router.refresh()
  }

  async function onRemove() {
    setBusy(true)
    const res = await removeContatoAvatar(orgSlug, contatoId)
    setBusy(false)
    if (!res.ok) { toast.error(res.error); return }
    setLocalUrl(null)
    toast.success('Foto removida.')
    router.refresh()
  }

  return (
    <div className="relative shrink-0 group">
      {shownUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shownUrl} alt={name} className="w-14 h-14 rounded-full object-cover" />
      ) : (
        <span className="w-14 h-14 rounded-full grid place-items-center bg-brand-100 text-brand-700 text-lg font-semibold">
          {initials(name)}
        </span>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground grid place-items-center shadow ring-2 ring-card disabled:opacity-50"
        aria-label="Trocar foto"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
      </button>
      {shownUrl && !busy && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white grid place-items-center shadow ring-2 ring-card opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Remover foto"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ── Diálogo de criação rápida ────────────────────────────────────────

export function NewContatoDialog({
  orgSlug, onCreated,
}: {
  orgSlug: string
  onCreated: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<ContatoStatus>('lead')
  const [source, setSource] = useState('manual')
  const [saving, setSaving] = useState(false)

  function reset() {
    setName(''); setEmail(''); setPhone(''); setStatus('lead'); setSource('manual')
  }

  async function submit() {
    if (!name.trim()) { toast.error('Informe o nome.'); return }
    setSaving(true)
    const res = await createContato(orgSlug, { name, email, phone, status, source })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Contato criado.')
    setOpen(false)
    reset()
    onCreated(res.id)
  }

  return (
    <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) reset() }}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 mr-1" /> Contato
      </Button>
      <DialogContent className="sm:max-w-md">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Novo contato</h2>
            <p className="text-sm text-muted-foreground">
              Endereço, documentos e foto você completa no painel depois de criar.
            </p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">E-mail</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Classificação</Label>
                <Select value={status} onValueChange={v => setStatus(v as ContatoStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_VALUES.map(s => (
                      <SelectItem key={s} value={s}>{CONTATO_STATUS_META[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Origem</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Cadastro manual</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="form">Formulário</SelectItem>
                    <SelectItem value="meta_ads">Meta Ads</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Criar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Sheet de filtros ─────────────────────────────────────────────────
