'use client'

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { X, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, parseCurrency } from '@/lib/utils'
import {
  updateLead, updateLeadValue, updateLeadTags, assignLead, moveLeadToStage,
  resolveContatoAvatars, addLeadNote, addNegotiationAction, deleteContatoActivity,
} from '@/actions/contatos'
import { LostMoveDialog, WonValueDialog, NegotiationValueDialog, isNegotiationStage } from '@/components/features/pipeline/StageMoveDialogs'
import { LeadAvatarUploader } from './LeadAvatarUploader'

export type Member = { user_id: string; name: string; email: string }
export type Stage = { id: string; name: string; is_won?: boolean; is_lost?: boolean }
export type ActivityItem = {
  id: string
  type: string
  payload: { text?: string; next_return_date?: string | null }
  created_at: string
  created_by: string | null
  created_by_name?: string | null
}
export type LeadDataTabHandle = { save: () => void }

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function fmtDate(s: string): string {
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('pt-BR')
}

const LeadDataTab = forwardRef<LeadDataTabHandle, {
  orgSlug: string
  lead: any
  fallbackPhone?: string | null
  stages: Stage[]
  members: Member[]
  /** Link opcional pra "Abrir lead" — quando omitido, o link não aparece. */
  leadHref?: string
  /** Quando passadas (só o popup da Pipeline passa), trocam a caixa simples
   *  de observação por uma lista de cards + adiciona o bloco de Ações. Sem
   *  elas, o componente se comporta exatamente como antes (WhatsApp/Instagram). */
  notes?: ActivityItem[]
  onNotesChange?: (next: ActivityItem[]) => void
  negotiationActions?: ActivityItem[]
  onActionsChange?: (next: ActivityItem[]) => void
  /** Esconde o botão "Salvar contato" daqui — usado quando o botão já vive
   *  no topo do popup (ver LeadDetailDrawer), acionado via ref. */
  hideInlineSaveButton?: boolean
}>(function LeadDataTab({
  orgSlug, lead, fallbackPhone, stages, members, leadHref,
  notes, onNotesChange, negotiationActions, onActionsChange, hideInlineSaveButton,
}, ref) {
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
  const [actionText, setActionText] = useState('')
  const [actionReturnDate, setActionReturnDate] = useState('')
  const [savingAction, setSavingAction] = useState(false)

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

  useImperativeHandle(ref, () => ({ save: handleSaveContact }))

  if (!lead) return null

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

  // Anotação rápida — quando `notes` é passado (popup da Pipeline), vira
  // uma lista de cards em vez de só uma caixa de escrever; nas outras telas
  // (WhatsApp/Instagram, notes===undefined) fica como sempre foi.
  const showRichNotes = notes !== undefined
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
    if (showRichNotes && onNotesChange && (res as any).activity) {
      onNotesChange([{ ...(res as any).activity, created_by_name: null }, ...notes!])
    }
  }

  const showActions = negotiationActions !== undefined
  async function handleAddAction() {
    const v = actionText.trim()
    if (!v) return
    setSavingAction(true)
    const res = await addNegotiationAction(orgSlug, lead.id, v, actionReturnDate || null)
    setSavingAction(false)
    if (!res.ok) { toast.error('Não foi possível registrar a ação', { description: res.error }); return }
    setActionText('')
    setActionReturnDate('')
    toast.success('Ação registrada')
    if (onActionsChange && res.activity) {
      onActionsChange([{ ...res.activity, created_by_name: null }, ...negotiationActions!])
    }
  }

  async function handleDeleteActivity(id: string, list: 'notes' | 'actions') {
    const res = await deleteContatoActivity(orgSlug, id)
    if (!res.ok) { toast.error('Não foi possível excluir', { description: res.error }); return }
    if (list === 'notes' && onNotesChange && notes) onNotesChange(notes.filter(n => n.id !== id))
    if (list === 'actions' && onActionsChange && negotiationActions) onActionsChange(negotiationActions.filter(a => a.id !== id))
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

        {/* Linha 1 — Nome / E-mail */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-muted-foreground">Nome</label>
            <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground">E-mail</label>
            <Input value={email} onChange={e => setEmail(e.target.value)} className="h-8 text-sm" type="email" />
          </div>
        </div>

        {/* Linha 2 — Telefone / CPF / Nascimento */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-muted-foreground">Telefone</label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground">CPF</label>
            <Input value={cpf} onChange={e => setCpf(e.target.value)} className="h-8 text-sm" placeholder="000.000.000-00" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground">Nascimento</label>
            <Input value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} className="h-8 text-sm" type="date" />
          </div>
        </div>

        {!hideInlineSaveButton && (
          <Button type="button" size="sm" variant="outline" onClick={handleSaveContact} disabled={savingContact} className="w-full mt-1">
            {savingContact ? 'Salvando...' : 'Salvar contato'}
          </Button>
        )}
      </section>

      {/* Linha 3 — Observações */}
      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observações</h4>

        {showRichNotes && notes!.length > 0 && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {notes!.map(n => (
              <div key={n.id} className="rounded-lg border bg-muted/40 p-2 text-sm group">
                <p className="whitespace-pre-wrap">{n.payload?.text}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {n.created_by_name ? `${n.created_by_name} · ` : ''}{fmtDateTime(n.created_at)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteActivity(n.id, 'notes')}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Excluir observação"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

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

      {/* Linha 4 — Tags */}
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

      {/* Valor / Estágio / Responsável lado a lado */}
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

      {/* Ações — timeline de tentativas/follow-ups da negociação, só no popup da Pipeline */}
      {showActions && (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações</h4>

          {negotiationActions!.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {negotiationActions!.map(a => (
                <div key={a.id} className="rounded-lg border bg-muted/40 p-2 text-sm group">
                  <p className="whitespace-pre-wrap">{a.payload?.text}</p>
                  {a.payload?.next_return_date && (
                    <p className="text-[11px] text-primary font-medium mt-0.5">
                      Retorno em: {fmtDate(a.payload.next_return_date)}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      {a.created_by_name ? `${a.created_by_name} · ` : ''}{fmtDateTime(a.created_at)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteActivity(a.id, 'actions')}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Excluir ação"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-start">
            <Input
              value={actionText}
              onChange={e => setActionText(e.target.value)}
              placeholder="Ex.: Liguei, sem resposta. Tentar de novo amanhã."
              className="h-8 text-sm flex-1"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddAction() } }}
            />
            <Input
              type="date"
              value={actionReturnDate}
              onChange={e => setActionReturnDate(e.target.value)}
              className="h-8 text-sm w-40"
              title="Data de retorno (opcional)"
            />
            <Button
              type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0"
              onClick={handleAddAction} disabled={savingAction || !actionText.trim()}
              aria-label="Adicionar ação"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </section>
      )}

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
})

export default LeadDataTab
