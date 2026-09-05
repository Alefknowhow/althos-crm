'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, parseCurrency } from '@/lib/utils'
import {
  updateLead, updateLeadValue, updateLeadTags, assignLead, moveLeadToStage,
  resolveContatoAvatars, addLeadNote,
} from '@/actions/contatos'
import { LostMoveDialog, WonValueDialog, NegotiationValueDialog, isNegotiationStage } from '@/components/features/pipeline/StageMoveDialogs'
import { LeadAvatarUploader } from './LeadAvatarUploader'

export type Member = { user_id: string; name: string; email: string }
export type Stage = { id: string; name: string; is_won?: boolean; is_lost?: boolean }

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
  const [tags, setTags] = useState<string[]>(lead?.tags ?? [])
  const [tagDraft, setTagDraft] = useState('')
  const [savingContact, setSavingContact] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(lead?.avatar_url ?? null)
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Popups ao mover pra etapa is_won/is_lost/"Negociação" — mesma regra do
  // Kanban (ver components/features/pipeline/StageMoveDialogs.tsx), só que
  // aqui a troca é feita direto num <select>, sem otimismo visual: só muda
  // de fato depois da confirmação.
  const [lostPrompt, setLostPrompt] = useState<string | null>(null)
  const [wonPrompt, setWonPrompt] = useState<string | null>(null)
  const [negotiationPrompt, setNegotiationPrompt] = useState<string | null>(null)

  useEffect(() => {
    setName(lead?.name ?? '')
    setEmail(lead?.email ?? '')
    setPhone(lead?.phone ?? fallbackPhone ?? '')
    setCpf(lead?.cpf ?? '')
    setDateOfBirth(lead?.date_of_birth ?? '')
    setValue(lead?.value_cents ? formatCurrency(lead.value_cents) : '')
    setTags(lead?.tags ?? [])
    setTagDraft('')
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

  async function commitStageChange(
    stageId: string,
    closeInfo?: { dealStatus: 'perdido' | 'desqualificado'; reason: string },
    valueCents?: number,
  ) {
    const res = await moveLeadToStage(orgSlug, lead.id, stageId, lead.stage_id, closeInfo, valueCents)
    if ((res as any)?.ok === false) toast.error('Não foi possível mover de estágio', { description: (res as any).error })
    else {
      toast.success('Estágio atualizado')
      if (valueCents != null) setValue(formatCurrency(valueCents))
    }
    router.refresh()
  }

  function handleChangeStage(stageId: string) {
    if (stageId === lead.stage_id) return
    const stage = stages.find(s => s.id === stageId)
    if (stage?.is_lost) { setLostPrompt(stageId); return }
    if (stage?.is_won) { setWonPrompt(stageId); return }
    if (isNegotiationStage(stage)) { setNegotiationPrompt(stageId); return }
    commitStageChange(stageId)
  }

  async function saveTags(next: string[]) {
    setTags(next)
    const res = await updateLeadTags(orgSlug, lead.id, next)
    if ((res as any)?.ok === false) toast.error('Não foi possível salvar as tags', { description: (res as any).error })
    router.refresh()
  }

  function handleAddTag() {
    const t = tagDraft.trim()
    if (!t) return
    if (!tags.includes(t)) saveTags([...tags, t])
    setTagDraft('')
  }

  function handleRemoveTag(t: string) {
    saveTags(tags.filter(x => x !== t))
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
        <Input
          value={tagDraft}
          onChange={e => setTagDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }}
          onBlur={handleAddTag}
          placeholder="Nova tag…"
          className="h-8 text-sm w-32"
        />
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {tags.map(t => (
              <Badge key={t} variant="secondary" className="text-[10px] gap-1 pr-1">
                {t}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(t)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remover ${t}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </Badge>
            ))}
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

      <LostMoveDialog
        open={!!lostPrompt}
        onCancel={() => setLostPrompt(null)}
        onConfirm={(dealStatus, reason) => {
          if (lostPrompt) commitStageChange(lostPrompt, { dealStatus, reason })
          setLostPrompt(null)
        }}
      />
      <WonValueDialog
        open={!!wonPrompt}
        defaultCents={lead.value_cents}
        onCancel={() => setWonPrompt(null)}
        onConfirm={valueCents => {
          if (wonPrompt) commitStageChange(wonPrompt, undefined, valueCents)
          setWonPrompt(null)
        }}
      />
      <NegotiationValueDialog
        open={!!negotiationPrompt}
        defaultCents={lead.value_cents}
        onCancel={() => setNegotiationPrompt(null)}
        onConfirm={valueCents => {
          if (negotiationPrompt) commitStageChange(negotiationPrompt, undefined, valueCents)
          setNegotiationPrompt(null)
        }}
      />
    </div>
  )
}
