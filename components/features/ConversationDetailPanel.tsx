'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatCurrency, parseCurrency } from '@/lib/utils'
import { updateLead, updateLeadValue, updateLeadTags, assignLead, moveLeadToStage } from '@/actions/contatos'
import { assignConversation, createLeadFromConversation } from '@/actions/whatsapp'

type Member = { user_id: string; name: string; email: string }

// 8 deterministic agent colors, indexed by a hash of the user id so the same
// atendente always gets the same color across the inbox and the panel.
const AGENT_COLORS = [
  'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-sky-500',
  'bg-violet-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500',
]

export function agentColor(userId: string | null | undefined): string {
  if (!userId) return 'bg-muted-foreground/40'
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
  return AGENT_COLORS[h % AGENT_COLORS.length]
}

export function memberInitials(name?: string, email?: string): string {
  const base = name?.trim() || email?.split('@')[0] || '?'
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

export default function ConversationDetailPanel({
  orgSlug,
  conversation,
  context,
  members,
  open,
  onToggle,
}: {
  orgSlug: string
  conversation: any
  context: any
  members: Member[]
  open: boolean
  onToggle: () => void
}) {
  const router = useRouter()
  const lead = context?.lead ?? null
  const stages: { id: string; name: string }[] = context?.stages ?? []

  const [name, setName] = useState(lead?.name ?? '')
  const [email, setEmail] = useState(lead?.email ?? '')
  const [phone, setPhone] = useState(lead?.phone ?? conversation?.contact_phone ?? '')
  const [value, setValue] = useState(lead?.value_cents ? formatCurrency(lead.value_cents) : '')
  const [tags, setTags] = useState((lead?.tags ?? []).join(', '))
  const [savingContact, setSavingContact] = useState(false)
  const [creating, setCreating] = useState(false)

  // Re-sync local state when a different conversation/lead is loaded.
  useEffect(() => {
    setName(lead?.name ?? '')
    setEmail(lead?.email ?? '')
    setPhone(lead?.phone ?? conversation?.contact_phone ?? '')
    setValue(lead?.value_cents ? formatCurrency(lead.value_cents) : '')
    setTags((lead?.tags ?? []).join(', '))
  }, [lead?.id, conversation?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Hybrid responsável: conversation owner takes precedence, lead owner is fallback.
  const responsibleId: string | null = conversation?.assigned_to ?? lead?.assigned_to ?? null
  const fromConversation = !!conversation?.assigned_to

  async function handleSaveContact() {
    if (!lead) return
    setSavingContact(true)
    const fd = new FormData()
    fd.set('name', name)
    fd.set('email', email)
    fd.set('phone', phone)
    const res = await updateLead(orgSlug, lead.id, fd)
    if ((res as any)?.ok === false) toast.error('Não foi possível salvar', { description: (res as any).error })
    else toast.success('Dados de contato atualizados')
    setSavingContact(false)
    router.refresh()
  }

  async function handleSaveValue() {
    if (!lead) return
    const cents = parseCurrency(value)
    const res = await updateLeadValue(orgSlug, lead.id, cents)
    if ((res as any)?.ok === false) toast.error('Não foi possível salvar o valor', { description: (res as any).error })
    else toast.success('Valor atualizado')
    router.refresh()
  }

  async function handleChangeStage(stageId: string) {
    if (!lead || stageId === lead.stage_id) return
    const res = await moveLeadToStage(orgSlug, lead.id, stageId, lead.stage_id)
    if ((res as any)?.ok === false) toast.error('Não foi possível mover de estágio', { description: (res as any).error })
    else toast.success('Estágio atualizado')
    router.refresh()
  }

  async function handleSaveTags() {
    if (!lead) return
    const arr = tags ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []
    const res = await updateLeadTags(orgSlug, lead.id, arr)
    if ((res as any)?.ok === false) toast.error('Não foi possível salvar as tags', { description: (res as any).error })
    else toast.success('Tags atualizadas')
    router.refresh()
  }

  async function handleAssignLeadOwner(userId: string | null) {
    if (!lead) return
    const res = await assignLead(orgSlug, lead.id, userId)
    if ((res as any)?.ok === false) toast.error('Não foi possível atribuir', { description: (res as any).error })
    else toast.success('Responsável pelo lead atualizado')
    router.refresh()
  }

  async function handleAssignConversation(userId: string | null) {
    const res = await assignConversation(orgSlug, conversation.id, userId)
    if (!res.ok) toast.error('Não foi possível atribuir o atendimento', { description: res.error })
    else toast.success('Responsável pelo atendimento atualizado')
    router.refresh()
  }

  async function handleCreateLead() {
    setCreating(true)
    const res = await createLeadFromConversation(orgSlug, conversation.id)
    if (!res.ok) toast.error('Não foi possível criar o lead', { description: res.error })
    else toast.success('Lead criado e vinculado à conversa')
    setCreating(false)
    router.refresh()
  }

  // Collapsed rail: a thin strip with just the expand button.
  if (!open) {
    return (
      <div className="hidden lg:flex flex-col items-center w-12 border-l bg-background shrink-0">
        <button
          type="button"
          onClick={onToggle}
          className="mt-4 p-2 rounded-md hover:bg-muted text-muted-foreground"
          title="Expandir painel do lead"
          aria-label="Expandir painel do lead"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        {responsibleId && (
          <div
            className={`mt-3 h-7 w-7 rounded-full ${agentColor(responsibleId)} text-white text-[10px] font-semibold flex items-center justify-center`}
            title="Responsável pelo atendimento"
          >
            {(() => { const m = members.find(x => x.user_id === responsibleId); return memberInitials(m?.name, m?.email) })()}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="hidden lg:flex flex-col w-80 xl:w-96 border-l bg-background shrink-0 overflow-hidden">
      <div className="h-16 px-4 border-b flex items-center justify-between shrink-0">
        <span className="font-semibold text-sm">Detalhes do lead</span>
        <button
          type="button"
          onClick={onToggle}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
          title="Retrair painel"
          aria-label="Retrair painel"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 text-sm">
        {/* Atendimento (sempre disponível, mesmo sem lead) */}
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Responsável pelo atendimento</h4>
          <select
            className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            value={conversation?.assigned_to ?? ''}
            onChange={e => handleAssignConversation(e.target.value || null)}
          >
            <option value="">Ninguém</option>
            {members.map(m => (
              <option key={m.user_id} value={m.user_id}>{m.name || m.email}</option>
            ))}
          </select>
          {!fromConversation && lead?.assigned_to && (
            <p className="text-[11px] text-muted-foreground">Herdado do responsável do lead.</p>
          )}
        </section>

        {!lead ? (
          <section className="space-y-3 rounded-lg border border-dashed p-4 text-center">
            <p className="text-muted-foreground text-xs">Esta conversa ainda não tem um lead vinculado.</p>
            <Button type="button" size="sm" onClick={handleCreateLead} disabled={creating} className="w-full">
              {creating ? 'Criando...' : 'Criar lead a partir do contato'}
            </Button>
          </section>
        ) : (
          <>
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dados de contato</h4>
                <Link href={`/app/${orgSlug}/contatos/${lead.id}`} className="text-[11px] text-primary hover:underline">Abrir lead</Link>
              </div>
              <label className="block text-xs text-muted-foreground">Nome</label>
              <Input value={name} onChange={e => setName(e.target.value)} className="h-9" />
              <label className="block text-xs text-muted-foreground">E-mail</label>
              <Input value={email} onChange={e => setEmail(e.target.value)} className="h-9" type="email" />
              <label className="block text-xs text-muted-foreground">Telefone</label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-9" />
              <Button type="button" size="sm" variant="outline" onClick={handleSaveContact} disabled={savingContact} className="w-full mt-1">
                {savingContact ? 'Salvando...' : 'Salvar contato'}
              </Button>
            </section>

            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valor do negócio</h4>
              <div className="flex gap-2">
                <Input value={value} onChange={e => setValue(e.target.value)} placeholder="R$ 0,00" className="h-9" onBlur={handleSaveValue} />
              </div>
            </section>

            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estágio</h4>
              <select
                className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                value={lead.stage_id ?? ''}
                onChange={e => handleChangeStage(e.target.value)}
              >
                {stages.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </section>

            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Responsável pelo lead</h4>
              <select
                className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                value={lead.assigned_to ?? ''}
                onChange={e => handleAssignLeadOwner(e.target.value || null)}
              >
                <option value="">Ninguém</option>
                {members.map(m => (
                  <option key={m.user_id} value={m.user_id}>{m.name || m.email}</option>
                ))}
              </select>
            </section>

            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</h4>
              <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="vip, retorno, orçamento" className="h-9" onBlur={handleSaveTags} />
              {(lead?.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {(lead.tags as string[]).map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
