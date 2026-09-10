'use client'

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ActionButton as Button } from '@/components/features/ActionButton'
import { LeadPipelineFields } from './LeadPipelineFields'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, parseCurrency } from '@/lib/utils'
import {
  updateLead, updateLeadValue, updateLeadTags, assignLead, moveLeadToStage,
  resolveContatoAvatars, addNegotiationAction,
} from '@/actions/contatos'
import { LostMoveDialog, WonValueDialog, NegotiationValueDialog, isNegotiationStage } from '@/components/features/pipeline/StageMoveDialogs'
import LeadOriginBadge from './LeadOriginBadge'
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

const LeadDataTab = forwardRef<LeadDataTabHandle, {
  orgSlug: string
  lead: any
  fallbackPhone?: string | null
  stages: Stage[]
  members: Member[]
  /** Link opcional pra "Abrir lead" — quando omitido, o link não aparece. */
  leadHref?: string
  /** Mostra o bloco de Ações (registro de tentativas/follow-up) — só o
   *  popup da Pipeline passa true, porque só ele tem a aba Timeline pra
   *  mostrar o histórico depois. `onActionAdded` deixa quem chamou (o
   *  Drawer) atualizar a lista local da Timeline sem esperar um refresh. */
  enableActions?: boolean
  onActionAdded?: (activity: ActivityItem) => void
  /** Esconde o botão "Salvar contato" daqui — usado quando o botão já vive
   *  no topo do popup (ver LeadDetailDrawer), acionado via ref. */
  hideInlineSaveButton?: boolean
}>(function LeadDataTab({
  orgSlug, lead, fallbackPhone, stages, members, leadHref,
  enableActions, onActionAdded, hideInlineSaveButton,
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
  const [internalNotes, setInternalNotes] = useState(lead?.internal_notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [actionText, setActionText] = useState('')
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
    setInternalNotes(lead?.internal_notes ?? '')
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

  // Observação — campo único editável em contatos.internal_notes (não é
  // mais uma lista de entradas em contato_activities: um só lugar pra
  // olhar e decidir, a timeline de Ações cobre o histórico de tentativas).
  async function handleSaveNotes() {
    setSavingNotes(true)
    const fd = new FormData()
    fd.set('internal_notes', internalNotes)
    const res = await updateLead(orgSlug, lead.id, fd)
    setSavingNotes(false)
    if ((res as any)?.ok === false) { toast.error('Não foi possível salvar a observação', { description: (res as any).error }); return }
    toast.success('Observação salva')
  }

  async function handleAddAction() {
    const v = actionText.trim()
    if (!v) return
    setSavingAction(true)
    const res = await addNegotiationAction(orgSlug, lead.id, v)
    setSavingAction(false)
    if (!res.ok) { toast.error('Não foi possível registrar a ação', { description: res.error }); return }
    setActionText('')
    toast.success('Ação registrada — veja na Timeline')
    if (onActionAdded && res.activity) onActionAdded({ ...res.activity, created_by_name: null } as ActivityItem)
  }

  return (
    <div className="space-y-6">
      <section className="flex items-center gap-3">
        <LeadAvatarUploader orgSlug={orgSlug} contatoId={lead.id} name={lead.name || name} url={avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{lead.name || name || 'Sem nome'}</div>
          {leadHref && <Link href={leadHref} className="text-[11px] text-primary hover:underline">Abrir lead</Link>}
        </div>
        {!hideInlineSaveButton && (
          <Button type="button" size="sm" variant="outline" onClick={handleSaveContact} pending={savingContact} className="shrink-0 h-8 px-3 text-xs">
            Salvar
          </Button>
        )}
      </section>

      <LeadOriginBadge lead={lead} />

      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dados de contato</h4>

        <div className="space-y-1 min-w-0">
          <label className="block text-xs text-muted-foreground">Nome</label>
          <Input value={name} onChange={e => setName(e.target.value)} className="h-8 min-w-0 px-2 text-xs md:text-xs" title={name} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1 min-w-0">
            <label className="block text-xs text-muted-foreground">E-mail</label>
            <Input value={email} onChange={e => setEmail(e.target.value)} className="h-8 min-w-0 px-2 text-xs md:text-xs" type="email" title={email} />
          </div>
          <div className="space-y-1 min-w-0">
            <label className="block text-xs text-muted-foreground">Telefone</label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-8 min-w-0 px-2 text-xs md:text-xs" type="tel" title={phone} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1 min-w-0">
            <label className="block text-xs text-muted-foreground">CPF</label>
            <Input value={cpf} onChange={e => setCpf(e.target.value)} className="h-8 min-w-0 px-2 text-xs md:text-xs" placeholder="000.000.000-00" title={cpf} />
          </div>
          <div className="space-y-1 min-w-0">
            <label className="block text-xs text-muted-foreground">Nascimento</label>
            <Input value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} className="h-8 min-w-0 px-2 text-xs md:text-xs" type="date" />
          </div>
        </div>
      </section>

      {/* Linha 3 — Observações (campo único, editável) */}
      <section className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observações</h4>
          <button
            type="button"
            onClick={handleSaveNotes}
            disabled={savingNotes || internalNotes === (lead?.internal_notes ?? '')}
            className="text-[11px] font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-default"
          >
            {savingNotes ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
        <Textarea
          value={internalNotes}
          onChange={e => setInternalNotes(e.target.value)}
          placeholder="Escreva uma observação sobre este lead..."
          rows={3}
          className="text-sm"
        />
      </section>

      <LeadPipelineFields
        tags={tags} tagDraft={tagDraft} onTagDraftChange={setTagDraft} onAddTag={handleAddTag} onRemoveTag={handleRemoveTag}
        value={value} onValueChange={setValue} onSaveValue={handleSaveValue}
        stageId={lead.stage_id} stages={stages} onChangeStage={handleChangeStage}
        assignedTo={lead.assigned_to} members={members} onAssign={handleAssignLeadOwner}
      />

      {/* Ações — registro de tentativas/follow-up; o histórico completo (com
          autor e data) fica só na aba Timeline logo abaixo, pra não duplicar
          a mesma informação em dois lugares. */}
      {enableActions && (
        <section className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações</h4>
          <p className="text-[11px] text-muted-foreground -mt-1">
            Registre o que foi feito na Timeline. Planeje as próximas ações na aba Tarefas.
          </p>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <label className="block text-[10px] text-muted-foreground">Ação realizada</label>
              <Input
                value={actionText}
                onChange={e => setActionText(e.target.value)}
                placeholder="Ex.: Liguei para apresentar a proposta."
                className="h-8 text-sm"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddAction() } }}
              />
            </div>
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
