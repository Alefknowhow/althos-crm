'use client'

/**
 * Coluna esquerda do painel do cliente — perfil + ações rápidas + dados
 * pessoais, sempre visível (não é mais uma aba). Estrutura 1:1 com o
 * artboard 26 do /design: avatar centralizado, pílula de status, NPS +
 * créditos lado a lado, WhatsApp/Ligar, lista de campos, canal de
 * aquisição, dados pessoais, documentos de viagem, parentes e tags.
 */

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Pencil, X } from 'lucide-react'
import { WhatsAppGlyph } from '@/components/features/LeadCard'
import { useCallDialer } from '@/components/features/voice/CallDialerModal'
import CustomerProfileForm from '@/components/features/customers/CustomerProfileForm'
import ContatoRelationships from '@/components/features/contatos/ContatoRelationships'
import { NpsCard } from './NpsSection'
import { CONTATO_STATUS_META } from '@/lib/contatos'
import { fmtCurrency, fmtDate, STATUS_VALUES, type Selected } from './ContatosViewShared'
import { AvatarUploader } from './ContatosViewWidgets'
import { OriginEditor } from './ContatosViewDetailHeader'

export function DetailSidebar({
  orgSlug, selected, c, isTravel, sellerName, creditBalance,
  savingStatus, onChangeStatus, savingSource, onChangeSource,
  tags, tagInput, setTagInput, onAddTag, onRemoveTag,
  openingConversation, onOpenConversation,
}: {
  orgSlug:             string
  selected:            NonNullable<Selected>
  c:                   NonNullable<Selected>['contato']
  isTravel:            boolean
  sellerName:          string | null | undefined
  creditBalance:       number
  savingStatus:        boolean
  onChangeStatus:      (v: string) => void
  savingSource:        boolean
  onChangeSource:      (v: { source: string; referred_by_contato_id?: string | null; referred_by_name?: string | null }) => void
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
    <div className="w-full lg:w-[340px] xl:w-[380px] shrink-0 space-y-5">
      {/* ── Perfil ──────────────────────────────────────────────── */}
      <div className="flex flex-col items-center text-center gap-2">
        <AvatarUploader orgSlug={orgSlug} contatoId={c.id} name={c.name} url={c.avatar_url} />
        <h2 className="text-lg font-bold leading-tight">{c.name}</h2>
        {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
        <div className="w-36 mt-1">
          <Select value={(c.status as string) || 'lead'} onValueChange={onChangeStatus} disabled={savingStatus}>
            <SelectTrigger className={`h-7 border-none rounded-full justify-center text-[12px] font-semibold ${meta?.badgeClass || ''}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_VALUES.map(s => (
                <SelectItem key={s} value={s} className="text-xs">{CONTATO_STATUS_META[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* NPS + Créditos */}
      <div className="grid grid-cols-2 gap-2">
        <NpsCard orgSlug={orgSlug} leadId={c.id} npsScore={c.nps_score ?? null} npsUpdatedAt={c.nps_updated_at ?? null} />
        {isTravel && (
          <div className="rounded-lg bg-card p-2.5 text-center">
            <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Créditos cancel.</div>
            <div className="text-sm font-bold mt-0.5 text-primary">{creditBalance > 0 ? fmtCurrency(creditBalance) : '—'}</div>
          </div>
        )}
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

      {/* Campos rápidos */}
      <div className="space-y-3.5">
        <SidebarField label="Telefone principal" value={c.phone || '—'} />
        <SidebarField label="E-mail" value={c.email || '—'} />
        <SidebarField label="Valor em negociação" value={c.value_cents ? fmtCurrency(c.value_cents) : '—'} />
        <SidebarField
          label={monthsAsCustomer != null ? `Cliente há ${monthsAsCustomer} meses` : 'Desde'}
          value={fmtDate(c.became_customer_at || c.created_at)}
        />
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Responsável</div>
          <div className="text-sm font-medium">{sellerName || '—'}</div>
        </div>
      </div>

      {/* Canal de aquisição */}
      <div className="rounded-lg bg-card p-3 space-y-2">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Canal de aquisição</div>
        <OriginEditor
          orgSlug={orgSlug}
          source={c.source ?? null}
          referredBy={c.referred_by ?? null}
          referredByName={c.referred_by_name ?? null}
          saving={savingSource}
          onChange={onChangeSource}
        />
      </div>

      {/* Dados pessoais */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Dados pessoais</div>
          <button type="button" onClick={() => setEditOpen(true)} className="text-muted-foreground hover:text-foreground">
            <Pencil className="w-3 h-3" />
          </button>
        </div>
        <div className="space-y-3">
          <SidebarField label="CPF" value={c.cpf || '—'} />
          <SidebarField label="Data de nascimento" value={c.date_of_birth ? fmtDate(c.date_of_birth) : '—'} />
          <SidebarField label="Endereço" value={address || '—'} />
        </div>
      </div>

      {/* Documentos de viagem — só nicho viagens */}
      {isTravel && (c.passport_number || c.has_us_visa) && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
            Documentos de viagem · segmento viagens
          </div>
          <div className="space-y-3">
            {c.passport_number && (
              <SidebarField label="Passaporte" value={`${c.passport_number}${c.passport_expiry ? ` · válido até ${fmtDate(c.passport_expiry)}` : ''}`} />
            )}
            {c.has_us_visa && <SidebarField label="Visto (EUA)" value="Possui" />}
          </div>
        </div>
      )}

      {/* Parentes */}
      <div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Parentes</div>
        <ContatoRelationships orgSlug={orgSlug} contatoId={c.id} initial={selected.relationships} />
      </div>

      {/* Tags */}
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

      {/* Edição completa (CPF/RG/passaporte/endereço/contatos) — o mesmo
          formulário de sempre, só que agora vive num modal em vez de
          embutido na aba, pra manter a coluna da esquerda só leitura. */}
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

function SidebarField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  )
}
