'use client'

/**
 * Coluna esquerda do painel do cliente — perfil + ações rápidas + dados
 * pessoais, sempre visível (não é aba). Ajustes pedidos após o primeiro
 * corte: NPS/créditos saíram daqui (foram pra Visão geral), canal de
 * aquisição virou etiqueta simples ao lado do status, parentesco virou
 * uma linha de texto livre + botão (sem popup/select), campos em 2
 * colunas, e o lápis de editar fica no topo, perto do telefone.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Pencil, X, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { WhatsAppGlyph } from '@/components/features/LeadCard'
import { useCallDialer } from '@/components/features/voice/CallDialerModal'
import CustomerProfileForm from '@/components/features/customers/CustomerProfileForm'
import { addRelationship, deleteRelationship } from '@/actions/relationships'
import { type RelationshipRow } from '@/lib/relationships'
import { CONTATO_STATUS_META, CONTATO_SOURCE_EDIT_OPTIONS, contatoSourceLabel } from '@/lib/contatos'
import { fmtCurrency, fmtDate, STATUS_VALUES, type Selected } from './ContatosViewShared'
import { AvatarUploader } from './ContatosViewWidgets'

export function DetailSidebar({
  orgSlug, selected, c, isTravel, sellerName,
  savingStatus, onChangeStatus, savingSource, onChangeSource,
  tags, tagInput, setTagInput, onAddTag, onRemoveTag,
  openingConversation, onOpenConversation,
}: {
  orgSlug:             string
  selected:            NonNullable<Selected>
  c:                   NonNullable<Selected>['contato']
  isTravel:            boolean
  sellerName:          string | null | undefined
  savingStatus:        boolean
  onChangeStatus:      (v: string) => void
  savingSource:        boolean
  onChangeSource:      (v: { source: string }) => void
  tags:                string[]
  tagInput:            string
  setTagInput:         (v: string) => void
  onAddTag:            () => void
  onRemoveTag:         (t: string) => void
  openingConversation: boolean
  onOpenConversation:  () => void
}) {
  const openDialer = useCallDialer()
  const [editOpen, setEditOpen] = useState(false)
  const meta = CONTATO_STATUS_META[(c.status as keyof typeof CONTATO_STATUS_META)] || null

  const addressParts = [c.street, c.number, c.complement, c.district, c.city, c.state].filter(Boolean)
  const address = addressParts.length ? addressParts.join(', ') : null
  const monthsAsCustomer = c.became_customer_at
    ? Math.max(0, Math.floor((Date.now() - new Date(c.became_customer_at).getTime()) / (30 * 86_400_000)))
    : null

  return (
    <div className="w-full lg:w-[360px] xl:w-[400px] shrink-0 space-y-5">
      {/* ── Perfil ──────────────────────────────────────────────── */}
      <div className="flex flex-col items-center text-center gap-2">
        <AvatarUploader orgSlug={orgSlug} contatoId={c.id} name={c.name} url={c.avatar_url} />
        <h2 className="text-lg font-bold leading-tight">{c.name}</h2>
        {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-fit">
            <Select value={(c.status as string) || 'lead'} onValueChange={onChangeStatus} disabled={savingStatus}>
              <SelectTrigger className={`h-7 border-none rounded-full justify-center gap-1 px-3 text-[12px] font-semibold ${meta?.badgeClass || ''}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_VALUES.map(s => (
                  <SelectItem key={s} value={s} className="text-xs">{CONTATO_STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Canal de aquisição — só a etiqueta, sem rastrear "indicado por quem". */}
          <div className="w-fit">
            <Select value={c.source || 'manual'} onValueChange={v => onChangeSource({ source: v })} disabled={savingSource}>
              <SelectTrigger className="h-7 border-none rounded-full justify-center gap-1 px-3 text-[12px] font-semibold bg-muted text-muted-foreground">
                <SelectValue>{contatoSourceLabel(c.source)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CONTATO_SOURCE_EDIT_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* WhatsApp / Ligar */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!c.phone || openingConversation}
          onClick={onOpenConversation}
          className="inline-flex items-center justify-center gap-2 h-9 rounded-full bg-secondary text-secondary-foreground text-[13px] font-semibold disabled:opacity-40"
        >
          <WhatsAppGlyph color="#25D366" /> WhatsApp
        </button>
        <button
          type="button"
          disabled={!c.phone}
          onClick={() => c.phone && openDialer({ contatoId: c.id, name: c.name, phone: c.phone })}
          className="inline-flex items-center justify-center gap-2 h-9 rounded-full bg-secondary text-secondary-foreground text-[13px] font-semibold disabled:opacity-40"
        >
          <WhatsAppGlyph color="#0a84ff" /> Ligar
        </button>
      </div>

      {/* Campos — 2 colunas, lápis de editar logo no topo (perto do telefone) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Dados do contato</div>
          <button type="button" onClick={() => setEditOpen(true)} className="text-muted-foreground hover:text-foreground" aria-label="Editar dados">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <SidebarField label="Telefone" value={c.phone || '—'} />
          <SidebarField label="E-mail" value={c.email || '—'} />
          <SidebarField label="Valor em negociação" value={c.value_cents ? fmtCurrency(c.value_cents) : '—'} />
          <SidebarField
            label={monthsAsCustomer != null ? `Cliente há ${monthsAsCustomer} meses` : 'Desde'}
            value={fmtDate(c.became_customer_at || c.created_at)}
          />
          <SidebarField label="Responsável" value={sellerName || '—'} />
          <SidebarField label="CPF" value={c.cpf || '—'} />
          <SidebarField label="Nascimento" value={c.date_of_birth ? fmtDate(c.date_of_birth) : '—'} />
          <SidebarField label="Endereço" value={address || '—'} className="col-span-2" clamp />
          {isTravel && (
            <>
              <SidebarField label="Passaporte" value={c.passport_number || '—'} />
              <SidebarField label="Validade passaporte" value={c.passport_expiry ? fmtDate(c.passport_expiry) : '—'} />
              <SidebarField label="Visto (EUA)" value={c.has_us_visa ? 'Possui' : 'Não possui'} className="col-span-2" />
            </>
          )}
        </div>
      </div>

      {/* Tags — acima de Parentesco */}
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map(t => (
          <Badge key={t} variant="secondary" className="text-[11px] gap-1 pr-1">
            {t}
            <button type="button" onClick={() => onRemoveTag(t)} aria-label={`Remover tag ${t}`} className="hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        <Input
          value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddTag() } }}
          onBlur={onAddTag}
          placeholder="+ tag"
          className="h-6 w-20 text-[11px] px-2 rounded-full bg-background"
        />
      </div>

      {/* Parentes — texto livre, uma linha por pessoa */}
      <RelationshipsSimple orgSlug={orgSlug} contatoId={c.id} initial={selected.relationships} />

      {/* Edição completa (CPF/RG/passaporte/endereço/contatos) — modal,
          aberto pelo lápis acima. */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <CustomerProfileForm
            orgSlug={orgSlug}
            leadId={c.id}
            initial={c}
            initialContactPoints={selected.contactPoints}
            initialDocuments={selected.documents}
            initialEditMode
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SidebarField({ label, value, className, clamp }: { label: string; value: string; className?: string; clamp?: boolean }) {
  return (
    <div className={`min-w-0 ${className || ''}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
      <div className={`text-sm font-medium ${clamp ? 'line-clamp-2' : 'truncate'}`}>{value}</div>
    </div>
  )
}

/** Parentesco simplificado — texto livre, sem grau/tipo. Aperta "+" (ou
 *  Enter) pra salvar e a linha vira uma informação de texto, igual às
 *  outras (endereço, etc). Sempre grava kind:'outro' — o campo não existe
 *  mais na UI, só no schema (mantido pra não quebrar o histórico já salvo
 *  com um grau específico). */
function RelationshipsSimple({ orgSlug, contatoId, initial }: { orgSlug: string; contatoId: string; initial: RelationshipRow[] }) {
  const router = useRouter()
  const [items, setItems] = useState<RelationshipRow[]>(initial)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  async function add() {
    const value = text.trim()
    if (!value || saving) return
    setSaving(true)
    const res = await addRelationship(orgSlug, { contatoId, kind: 'outro', relatedName: value })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    setText('')
    // A action não devolve a linha criada — adiciona otimista (id
    // temporário) e revalida em segundo plano pra reconciliar com o servidor.
    setItems(prev => [...prev, {
      id: `tmp-${Date.now()}`,
      kind: 'outro',
      note: null,
      related_contato_id: null,
      related_name: value,
      related_cpf: null,
      related_birth_date: null,
      created_at: new Date().toISOString(),
    }])
    router.refresh()
  }

  async function remove(id: string) {
    setItems(prev => prev.filter(r => r.id !== id))
    const res = await deleteRelationship(orgSlug, id, contatoId)
    if (!res.ok) toast.error(res.error)
    else router.refresh()
  }

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Parentes</div>
      <div className="space-y-1.5 mb-2">
        {items.map(r => (
          <div key={r.id} className="group flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{r.related_name}</span>
            <button
              type="button"
              onClick={() => remove(r.id)}
              className="shrink-0 text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
              aria-label="Remover"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="Nome · data de nascimento · CPF..."
          className="h-8 text-sm flex-1"
        />
        <button
          type="button"
          onClick={add}
          disabled={saving || !text.trim()}
          className="shrink-0 w-8 h-8 grid place-items-center rounded-full bg-secondary text-secondary-foreground disabled:opacity-40"
          aria-label="Adicionar parente"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
