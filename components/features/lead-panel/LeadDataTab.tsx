'use client'

import { forwardRef, useImperativeHandle } from 'react'
import Link from 'next/link'
import { X, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ActionButton as Button } from '@/components/features/ActionButton'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { parseCurrency, formatCurrency } from '@/lib/utils'
import { LostMoveDialog, WonValueDialog, NegotiationValueDialog } from '@/components/features/pipeline/StageMoveDialogs'
import LeadOriginBadge from './LeadOriginBadge'
import { LeadAvatarUploader } from './LeadAvatarUploader'
import { useLeadDataTabState } from './useLeadDataTabState'

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
  const {
    name, setName, email, setEmail, phone, setPhone, cpf, setCpf, dateOfBirth, setDateOfBirth,
    value, setValue, tags, tagDraft, setTagDraft, savingContact, avatarUrl, internalNotes, setInternalNotes,
    savingNotes, actionText, setActionText, savingAction,
    lostPrompt, setLostPrompt, wonPrompt, setWonPrompt, negotiationPrompt, setNegotiationPrompt,
    handleSaveContact, handleSaveValue, commitStageChange, handleChangeStage,
    handleAddTag, handleRemoveTag, handleAssignLeadOwner, handleSaveNotes, handleAddAction,
  } = useLeadDataTabState(orgSlug, lead, fallbackPhone, stages, onActionAdded)

  useImperativeHandle(ref, () => ({ save: handleSaveContact }))

  if (!lead) return null

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

      {/* Valor e estágio juntos; responsável com a largura inteira. */}
      <section className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Valor</h4>
          <Input
            value={value}
            inputMode="numeric"
            onChange={e => {
              const cents = parseCurrency(e.target.value)
              setValue(cents > 0 ? formatCurrency(cents) : '')
            }}
            placeholder="R$ 0,00"
            className="h-8 min-w-0 px-2 text-xs md:text-xs"
            onBlur={handleSaveValue}
          />
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
        <div className="space-y-1 min-w-0 col-span-2">
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
