'use client'

/**
 * Coluna esquerda do painel do cliente — perfil + ações rápidas + dados
 * pessoais, sempre visível (não é aba). Redesenhada na issue #63: dados em
 * grid de 2 colunas, endereço em seção própria, ações rápidas compactas
 * (WhatsApp/Ligar/E-mail/Mais) e pessoas relacionadas com grau + idade,
 * limitadas a 3 + "ver todos".
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Pencil, X, Plus, Mail, Trash2, Link2, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { WhatsAppGlyph } from '@/components/features/LeadCard'
import { useCallDialer } from '@/components/features/voice/CallDialerModal'
import CustomerProfileForm from '@/components/features/customers/CustomerProfileForm'
import { addRelationship, deleteRelationship } from '@/actions/relationships'
import { RELATIONSHIP_LABELS, type RelationshipRow } from '@/lib/relationships'
import { CONTATO_STATUS_META, CONTATO_SOURCE_EDIT_OPTIONS, contatoSourceLabel } from '@/lib/contatos'
import { fmtDate, STATUS_VALUES, type Selected } from './ContatosViewShared'
import { AvatarUploader } from './ContatosViewWidgets'

export function DetailSidebar({
  orgSlug, selected, c, isTravel, sellerName,
  savingStatus, onChangeStatus, savingSource, onChangeSource,
  tags, tagInput, setTagInput, onAddTag, onRemoveTag,
  openingConversation, onOpenConversation, autoEditOpen,
  onDelete, deleting,
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
  autoEditOpen?:       boolean
  onDelete:            () => void
  deleting:            boolean
}) {
  const openDialer = useCallDialer()
  const [editOpen, setEditOpen] = useState(!!autoEditOpen)
  const meta = CONTATO_STATUS_META[(c.status as keyof typeof CONTATO_STATUS_META)] || null

  function copyLink() {
    const url = `${window.location.origin}/app/${orgSlug}/contatos/${c.id}`
    navigator.clipboard.writeText(url).then(
      () => toast.success('Link copiado.'),
      () => toast.error('Não foi possível copiar o link.'),
    )
  }

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

      {/* Ações rápidas — quadradas, compactas, com tooltip */}
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center justify-center gap-2">
          <QuickActionButton
            tooltip={c.phone ? 'WhatsApp' : 'Telefone não informado'}
            disabled={!c.phone || openingConversation}
            onClick={onOpenConversation}
          >
            <WhatsAppGlyph color="#25D366" />
          </QuickActionButton>
          <QuickActionButton
            tooltip={c.phone ? 'Ligar' : 'Telefone não informado'}
            disabled={!c.phone}
            onClick={() => c.phone && openDialer({ contatoId: c.id, name: c.name, phone: c.phone })}
          >
            <WhatsAppGlyph color="#0a84ff" />
          </QuickActionButton>
          <QuickActionButton
            tooltip={c.email ? 'E-mail' : 'E-mail não informado'}
            disabled={!c.email}
            onClick={() => c.email && (window.location.href = `mailto:${c.email}`)}
          >
            <Mail className="w-[18px] h-[18px]" />
          </QuickActionButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Mais ações"
                className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-secondary text-secondary-foreground hover:opacity-90 transition-opacity"
              >
                <MoreHorizontal className="w-[18px] h-[18px]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="w-3.5 h-3.5 mr-2" /> Editar contato
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyLink}>
                <Link2 className="w-3.5 h-3.5 mr-2" /> Copiar link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete} disabled={deleting}>
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir contato
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TooltipProvider>

      {/* Dados do contato — 2 colunas */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Dados do contato</div>
          <button type="button" onClick={() => setEditOpen(true)} className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1" aria-label="Editar dados do contato">
            <Pencil className="w-3 h-3" /> Editar
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <SidebarField label="Telefone" value={c.phone || 'Não informado'} />
          <SidebarField label="E-mail" value={c.email || 'Não informado'} />
          <SidebarField label="CPF" value={c.cpf || 'Não informado'} />
          <SidebarField label="Nascimento" value={c.date_of_birth ? fmtDate(c.date_of_birth) : 'Não informado'} />
          <SidebarField label="Responsável" value={sellerName || 'Não informado'} />
          <SidebarField label="Criado em" value={fmtDate(c.created_at)} />
          {isTravel && (
            <>
              <SidebarField label="Passaporte" value={c.passport_number || 'Não informado'} />
              <SidebarField label="Validade passaporte" value={c.passport_expiry ? fmtDate(c.passport_expiry) : 'Não informado'} />
              <SidebarField label="Visto (EUA)" value={c.has_us_visa ? 'Possui' : 'Não possui'} className="col-span-2" />
            </>
          )}
        </div>
      </div>

      {/* Endereço — seção própria, 2 colunas */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Endereço</div>
          <button type="button" onClick={() => setEditOpen(true)} className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1" aria-label="Editar endereço">
            <Pencil className="w-3 h-3" /> Editar
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <SidebarField label="CEP" value={c.postal_code || 'Não informado'} />
          <SidebarField label="Bairro" value={c.district || 'Não informado'} />
          <SidebarField label="Cidade / UF" value={c.city ? `${c.city}${c.state ? ` / ${c.state}` : ''}` : 'Não informado'} />
          <SidebarField label="Complemento" value={c.complement || 'Não informado'} />
          <SidebarField
            label="Rua / número"
            value={c.street ? `${c.street}${c.number ? `, ${c.number}` : ''}` : 'Não informado'}
            className="col-span-2"
            clamp
          />
        </div>
      </div>

      {/* Tags */}
      <div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Tags</div>
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
      </div>

      {/* Pessoas relacionadas */}
      <RelatedPeople orgSlug={orgSlug} contatoId={c.id} initial={selected.relationships} />

      {/* Edição completa (CPF/RG/passaporte/endereço/contatos) — modal,
          aberto pelo "Editar" das seções acima ou pelo menu "Mais ações". */}
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

function QuickActionButton({
  tooltip, disabled, onClick, children,
}: { tooltip: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          onClick={onClick}
          className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-secondary text-secondary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

function SidebarField({ label, value, className, clamp }: { label: string; value: string; className?: string; clamp?: boolean }) {
  return (
    <div className={`min-w-0 ${className || ''}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-0.5">{label}</div>
      <div className={`text-[13.5px] font-semibold text-foreground ${clamp ? 'line-clamp-2' : 'truncate'}`}>{value}</div>
    </div>
  )
}

function ageFromBirthDate(d: string | null): number | null {
  if (!d) return null
  const birth = new Date(d)
  if (Number.isNaN(birth.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

/** Pessoas relacionadas — campo único de texto livre (sem grau/idade
 *  estruturados). Mostra só as 3 primeiras na sidebar; o resto fica atrás
 *  de "Ver todos" (drawer), sem aumentar a altura da página. */
function RelatedPeople({ orgSlug, contatoId, initial }: { orgSlug: string; contatoId: string; initial: RelationshipRow[] }) {
  const router = useRouter()
  const [items, setItems] = useState<RelationshipRow[]>(initial)
  const [seeAllOpen, setSeeAllOpen] = useState(false)

  const visible = useMemo(() => items.slice(0, 3), [items])

  async function remove(id: string) {
    setItems(prev => prev.filter(r => r.id !== id))
    const res = await deleteRelationship(orgSlug, id, contatoId)
    if (!res.ok) toast.error(res.error)
    else router.refresh()
  }

  function onCreated(row: RelationshipRow) {
    setItems(prev => [...prev, row])
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Pessoas relacionadas</div>
        <button
          type="button"
          onClick={() => setSeeAllOpen(true)}
          className="w-6 h-6 grid place-items-center rounded-full bg-secondary text-secondary-foreground"
          aria-label="Adicionar pessoa relacionada"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma pessoa relacionada.{' '}
          <button type="button" onClick={() => setSeeAllOpen(true)} className="text-primary hover:underline">
            + Adicionar pessoa
          </button>
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {visible.map(r => (
              <RelatedPersonRow key={r.id} r={r} onRemove={() => remove(r.id)} />
            ))}
          </div>
          {items.length > 3 && (
            <button type="button" onClick={() => setSeeAllOpen(true)} className="text-xs text-primary hover:underline mt-2">
              Ver todos os {items.length} relacionados →
            </button>
          )}
        </>
      )}

      <RelatedPeopleDialog
        open={seeAllOpen}
        onOpenChange={setSeeAllOpen}
        orgSlug={orgSlug}
        contatoId={contatoId}
        items={items}
        onCreated={onCreated}
        onRemove={remove}
      />
    </div>
  )
}

function RelatedPersonRow({ r, onRemove }: { r: RelationshipRow; onRemove: () => void }) {
  // Vínculos antigos (com grau + idade) continuam mostrando essa segunda
  // linha; vínculos novos são só texto livre, sem grau/idade a exibir.
  const age = ageFromBirthDate(r.related_birth_date)
  const kindLabel = RELATIONSHIP_LABELS[r.kind] || r.kind
  const showMeta = r.kind !== 'outro' || age != null
  return (
    <div className="group flex items-center justify-between gap-2 text-sm">
      <div className="min-w-0">
        <div className="font-medium truncate">{r.related_name}</div>
        {showMeta && (
          <div className="text-xs text-muted-foreground truncate">
            {kindLabel}{age != null ? ` · ${age} anos` : ''}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
        aria-label="Remover"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}

function RelatedPeopleDialog({
  open, onOpenChange, orgSlug, contatoId, items, onCreated, onRemove,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  orgSlug: string
  contatoId: string
  items: RelationshipRow[]
  onCreated: (row: RelationshipRow) => void
  onRemove: (id: string) => void
}) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  async function add() {
    if (!text.trim()) { toast.error('Digite algo sobre a pessoa relacionada.'); return }
    setSaving(true)
    // Sem grau/idade estruturados — tudo digitado livre vai pro nome do
    // vínculo. 'outro' é só o valor fixo exigido pela coluna kind no banco.
    const res = await addRelationship(orgSlug, {
      contatoId, kind: 'outro', relatedName: text.trim(), relatedBirthDate: null,
    })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    onCreated({
      id: `tmp-${Date.now()}`,
      kind: 'outro',
      note: null,
      related_contato_id: null,
      related_name: text.trim(),
      related_cpf: null,
      related_birth_date: null,
      created_at: new Date().toISOString(),
    })
    setText('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pessoas relacionadas</DialogTitle>
        </DialogHeader>

        <div className="flex items-end gap-2 rounded-lg border p-3 bg-muted/20">
          <div className="flex-1 min-w-0 space-y-1">
            <label className="text-[10px] uppercase text-muted-foreground font-semibold">Pessoa relacionada</label>
            <Input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
              placeholder="Ex.: Esposa Maria, 34 anos, viaja junto"
              className="h-9"
            />
          </div>
          <Button size="sm" className="shrink-0" onClick={add} disabled={saving}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-1 max-h-[50vh] overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma pessoa relacionada ainda.</p>
          ) : items.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
              <RelatedPersonRow r={r} onRemove={() => onRemove(r.id)} />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
