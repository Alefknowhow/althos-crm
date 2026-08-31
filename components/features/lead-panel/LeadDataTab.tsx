'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ImagePlus, Loader2 } from 'lucide-react'
import { formatCurrency, parseCurrency } from '@/lib/utils'
import {
  updateLead, updateLeadValue, updateLeadTags, assignLead, moveLeadToStage,
  uploadContatoAvatar, removeContatoAvatar, resolveContatoAvatars, addLeadNote,
} from '@/actions/contatos'

export type Member = { user_id: string; name: string; email: string }
export type Stage = { id: string; name: string }

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
 *  na criação), mas o atendente pode trocar por uma manual aqui do mesmo jeito. */
function LeadAvatarUploader({
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

export default function LeadDataTab({
  orgSlug,
  lead,
  fallbackPhone,
  stages,
  members,
  leadHref,
}: {
  orgSlug: string
  lead: any
  fallbackPhone?: string | null
  stages: Stage[]
  members: Member[]
  /** Link opcional pra "Abrir lead" — quando omitido, o link não aparece. */
  leadHref?: string
}) {
  const router = useRouter()
  const [name, setName] = useState(lead?.name ?? '')
  const [email, setEmail] = useState(lead?.email ?? '')
  const [phone, setPhone] = useState(lead?.phone ?? fallbackPhone ?? '')
  const [cpf, setCpf] = useState(lead?.cpf ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(lead?.date_of_birth ?? '')
  const [value, setValue] = useState(lead?.value_cents ? formatCurrency(lead.value_cents) : '')
  const [tags, setTags] = useState((lead?.tags ?? []).join(', '))
  const [savingContact, setSavingContact] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(lead?.avatar_url ?? null)
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  useEffect(() => {
    setName(lead?.name ?? '')
    setEmail(lead?.email ?? '')
    setPhone(lead?.phone ?? fallbackPhone ?? '')
    setCpf(lead?.cpf ?? '')
    setDateOfBirth(lead?.date_of_birth ?? '')
    setValue(lead?.value_cents ? formatCurrency(lead.value_cents) : '')
    setTags((lead?.tags ?? []).join(', '))
    setAvatarUrl(lead?.avatar_url ?? null)
  }, [lead?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve avatar_storage_object_id -> signed URL do R2, quando aplicável
  // (lead legado/instagram com avatar_url direto não precisa disso — ver
  // resolveContatoAvatars em actions/contatos.ts).
  useEffect(() => {
    if (!lead?.id || !lead?.avatar_storage_object_id) return
    let active = true
    resolveContatoAvatars(orgSlug, [{ avatar_url: lead.avatar_url ?? null, avatar_storage_object_id: lead.avatar_storage_object_id }])
      .then(([resolved]) => { if (active && resolved?.avatar_url) setAvatarUrl(resolved.avatar_url) })
      .catch(() => {})
    return () => { active = false }
  }, [orgSlug, lead?.id, lead?.avatar_storage_object_id, lead?.avatar_url])

  if (!lead) return null

  async function handleSaveContact() {
    setSavingContact(true)
    const fd = new FormData()
    fd.set('name', name)
    fd.set('email', email)
    fd.set('phone', phone)
    fd.set('cpf', cpf)
    fd.set('date_of_birth', dateOfBirth)
    const res = await updateLead(orgSlug, lead.id, fd)
    if ((res as any)?.ok === false) toast.error('Não foi possível salvar', { description: (res as any).error })
    else toast.success('Dados de contato atualizados')
    setSavingContact(false)
    router.refresh()
  }

  async function handleSaveValue() {
    const cents = parseCurrency(value)
    const res = await updateLeadValue(orgSlug, lead.id, cents)
    if ((res as any)?.ok === false) toast.error('Não foi possível salvar o valor', { description: (res as any).error })
    else toast.success('Valor atualizado')
    router.refresh()
  }

  async function handleChangeStage(stageId: string) {
    if (stageId === lead.stage_id) return
    const res = await moveLeadToStage(orgSlug, lead.id, stageId, lead.stage_id)
    if ((res as any)?.ok === false) toast.error('Não foi possível mover de estágio', { description: (res as any).error })
    else toast.success('Estágio atualizado')
    router.refresh()
  }

  async function handleSaveTags() {
    const arr = tags ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []
    const res = await updateLeadTags(orgSlug, lead.id, arr)
    if ((res as any)?.ok === false) toast.error('Não foi possível salvar as tags', { description: (res as any).error })
    else toast.success('Tags atualizadas')
    router.refresh()
  }

  async function handleAssignLeadOwner(userId: string | null) {
    const res = await assignLead(orgSlug, lead.id, userId)
    if ((res as any)?.ok === false) toast.error('Não foi possível atribuir', { description: (res as any).error })
    else toast.success('Responsável atualizado')
    router.refresh()
  }

  // Anotação rápida sem sair da aba Dados — grava no mesmo lugar da aba
  // Anotações (contato_activities type='note'), só não lista o histórico
  // aqui (isso já existe na aba dedicada).
  async function handleAddNote() {
    const v = note.trim()
    if (!v) return
    setSavingNote(true)
    const fd = new FormData()
    fd.set('text', v)
    const res = await addLeadNote(orgSlug, lead.id, fd)
    setSavingNote(false)
    if ((res as any)?.ok === false) { toast.error('Não foi possível salvar a anotação', { description: (res as any).error }); return }
    setNote('')
    toast.success('Anotação adicionada')
  }

  return (
    <div className="space-y-6">
      <section className="flex items-center gap-3">
        <LeadAvatarUploader orgSlug={orgSlug} contatoId={lead.id} name={lead.name || name} url={avatarUrl} />
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{lead.name || name || 'Sem nome'}</div>
          {leadHref && <Link href={leadHref} className="text-[11px] text-primary hover:underline">Abrir lead</Link>}
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dados de contato</h4>
        <label className="block text-xs text-muted-foreground">Nome</label>
        <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" />

        {/* Linha 1 — E-mail / Telefone */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-muted-foreground">E-mail</label>
            <Input value={email} onChange={e => setEmail(e.target.value)} className="h-8 text-sm" type="email" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground">Telefone</label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>

        {/* Linha 2 — CPF / Nascimento */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-muted-foreground">CPF</label>
            <Input value={cpf} onChange={e => setCpf(e.target.value)} className="h-8 text-sm" placeholder="000.000.000-00" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground">Nascimento</label>
            <Input value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} className="h-8 text-sm" type="date" />
          </div>
        </div>

        {/* Linha 3 — Salvar */}
        <Button type="button" size="sm" variant="outline" onClick={handleSaveContact} disabled={savingContact} className="w-full mt-1">
          {savingContact ? 'Salvando...' : 'Salvar contato'}
        </Button>
      </section>

      {/* Linha 4 — Valor / Estágio / Responsável lado a lado */}
      <section className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Valor</h4>
          <Input value={value} onChange={e => setValue(e.target.value)} placeholder="R$ 0,00" className="h-8 text-sm" onBlur={handleSaveValue} />
        </div>
        <div className="space-y-1">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Estágio</h4>
          <select
            className="w-full h-8 rounded-md border border-input bg-input/25 px-1.5 text-xs"
            value={lead.stage_id ?? ''}
            onChange={e => handleChangeStage(e.target.value)}
          >
            {stages.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Responsável</h4>
          <select
            className="w-full h-8 rounded-md border border-input bg-input/25 px-1.5 text-xs"
            value={lead.assigned_to ?? ''}
            onChange={e => handleAssignLeadOwner(e.target.value || null)}
          >
            <option value="">Ninguém</option>
            {members.map(m => (
              <option key={m.user_id} value={m.user_id}>{m.name || m.email}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Linha 5 — Tags */}
      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</h4>
        <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="vip, retorno, orçamento" className="h-8 text-sm" onBlur={handleSaveTags} />
        {(lead?.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {(lead.tags as string[]).map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
          </div>
        )}
      </section>

      {/* Linha 6 — Anotação rápida (histórico completo mora na aba Anotações) */}
      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observações</h4>
        <Textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Escreva uma observação sobre este lead..."
          rows={2}
          className="text-sm"
        />
        <Button type="button" size="sm" variant="outline" onClick={handleAddNote} disabled={savingNote || !note.trim()} className="w-full">
          {savingNote ? 'Salvando...' : 'Adicionar observação'}
        </Button>
      </section>
    </div>
  )
}
