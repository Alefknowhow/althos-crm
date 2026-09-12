'use client'

import { useState } from 'react'
import { WhatsAppGlyph } from '@/components/features/LeadCard'
import { cn, formatPhoneDisplay } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus, ChevronLeft, Wallet, CalendarClock, Trash2, X, RefreshCw, UserCircle2, Sparkles,
  Tag as TagIcon, Coins, PhoneCall, MoreVertical, Pencil,
} from 'lucide-react'
import { CONTATO_STATUS_META, CONTATO_SOURCE_EDIT_OPTIONS, contatoSourceLabel } from '@/lib/contatos'
import AIScoreBadge from '@/components/features/ai/AIScoreBadge'
import RequalifyButton from '@/components/features/ai/RequalifyButton'
import SendEmailDialog from '@/components/features/SendEmailDialog'
import LeadCombobox from '@/components/features/LeadCombobox'
import { fmtCurrency, fmtDate, onlyDigits, STATUS_VALUES, type Selected } from './ContatosViewShared'
import { AvatarUploader } from './ContatosViewWidgets'
import { Field } from './ContatosViewDetailHelpers'
import { NpsCard } from './NpsSection'
import { useCallDialer } from '@/components/features/voice/CallDialerModal'

/** Origem editável + "Indicado por" quando a origem é Indicação. Some as
 *  opções de origem já conhecidas cobrem a maioria dos casos; se o valor
 *  atual for algo antigo/livre (ex.: "form:Nome do Form"), ele aparece como
 *  uma opção extra no topo pra não sumir do Select ao abrir a tela. */
function OriginEditor({
  orgSlug, source, referredBy, referredByName, saving, onChange,
}: {
  orgSlug: string
  source: string | null
  referredBy: { id: string; name: string } | null
  referredByName: string | null
  saving: boolean
  onChange: (v: { source: string; referred_by_contato_id?: string | null; referred_by_name?: string | null }) => void
}) {
  const current = source || 'manual'
  const isKnown = CONTATO_SOURCE_EDIT_OPTIONS.some(o => o.value === current)
  const [usingFreeText, setUsingFreeText] = useState(!referredBy && !!referredByName)

  return (
    <div className="space-y-1.5 w-64">
      <Select
        value={current}
        onValueChange={v => onChange({ source: v, referred_by_contato_id: referredBy?.id ?? null, referred_by_name: referredByName })}
        disabled={saving}
      >
        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
        <SelectContent>
          {!isKnown && <SelectItem value={current}>{contatoSourceLabel(current)}</SelectItem>}
          {CONTATO_SOURCE_EDIT_OPTIONS.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {current === 'indicacao' && (
        <div className="space-y-1">
          {usingFreeText ? (
            <div className="flex gap-1">
              <Input
                className="h-8 text-xs"
                placeholder="Nome de quem indicou"
                defaultValue={referredByName || ''}
                onBlur={e => onChange({ source: current, referred_by_contato_id: null, referred_by_name: e.target.value })}
              />
              <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-[11px]" onClick={() => setUsingFreeText(false)}>
                Buscar
              </Button>
            </div>
          ) : (
            <div className="flex gap-1 items-center">
              <div className="flex-1">
                <LeadCombobox
                  name="referred_by_contato_id"
                  orgSlug={orgSlug}
                  defaultLead={referredBy}
                  placeholder="Quem indicou?"
                  onChange={lead => onChange({ source: current, referred_by_contato_id: lead?.id ?? null, referred_by_name: null })}
                />
              </div>
              <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-[11px] shrink-0" onClick={() => setUsingFreeText(true)}>
                Não cadastrado
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function DetailHeader({
  orgSlug, selected, c, onBack, isTravel, savingStatus, onChangeStatus,
  savingSource, onChangeSource,
  tags, tagInput, setTagInput, onAddTag, onRemoveTag,
  totalPurchased, lastPurchase, sellerName, creditBalance,
  openingConversation, onOpenConversation, orgName,
  onNewTask, reopening, onReopen, onEditDados, deleting, onDelete,
}: {
  orgSlug:              string
  selected:             NonNullable<Selected>
  c:                    NonNullable<Selected>['contato']
  onBack:               () => void
  isTravel:             boolean
  savingStatus:         boolean
  onChangeStatus:       (v: string) => void
  savingSource:         boolean
  onChangeSource:       (v: { source: string; referred_by_contato_id?: string | null; referred_by_name?: string | null }) => void
  tags:                 string[]
  tagInput:             string
  setTagInput:          (v: string) => void
  onAddTag:             () => void
  onRemoveTag:          (t: string) => void
  totalPurchased:       number
  lastPurchase:         string | null
  sellerName:           string | null | undefined
  creditBalance:        number
  openingConversation:  boolean
  onOpenConversation:   () => void
  orgName:              string
  onNewTask:            () => void
  reopening:            boolean
  onReopen:             () => void
  onEditDados:          () => void
  deleting:             boolean
  onDelete:             () => void
}) {
  const stageName = c.pipeline_stages?.name as string | undefined
  const openDialer = useCallDialer()

  return (
    <>
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="md:hidden mt-1 text-muted-foreground hover:text-foreground" aria-label="Voltar">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <AvatarUploader orgSlug={orgSlug} contatoId={c.id} name={c.name} url={c.avatar_url} />
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold leading-tight break-words">{c.name}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {c.phone && <span>{formatPhoneDisplay(c.phone)}</span>}
            {c.email && <span>{c.phone ? ' · ' : ''}{c.email}</span>}
            {stageName ? `${(c.phone || c.email) ? ' · ' : ''}Funil: ${stageName}` : ''}
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <div className="w-44">
              <Select value={(c.status as string) || 'lead'} onValueChange={onChangeStatus} disabled={savingStatus}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_VALUES.map(s => (
                    <SelectItem key={s} value={s}>{CONTATO_STATUS_META[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <OriginEditor
              orgSlug={orgSlug}
              source={c.source ?? null}
              referredBy={c.referred_by ?? null}
              referredByName={c.referred_by_name ?? null}
              saving={savingSource}
              onChange={onChangeSource}
            />
          </div>
        </div>
      </div>

      {/* Tags — bloco de linha única destacado, sempre visível no topo */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-primary/[0.04] border-primary/20 px-3 py-2">
        <TagIcon className="w-3.5 h-3.5 text-primary shrink-0" />
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
          className="h-6 w-20 text-[11px] px-2 bg-background"
        />
      </div>

      {/* Cards de resumo — compactos, logo abaixo das tags */}
      <div className={cn(
        'grid grid-cols-2 gap-2',
        isTravel && c.status === 'cliente' ? 'lg:grid-cols-6'
          : (isTravel || c.status === 'cliente') ? 'lg:grid-cols-5'
          : 'lg:grid-cols-4'
      )}>
        <Field icon={Wallet} label="Total comprado" dense>
          <span className="text-base font-bold text-primary">{fmtCurrency(totalPurchased)}</span>
        </Field>
        <Field icon={CalendarClock} label="Última compra" dense>
          <span className="text-base font-bold">{fmtDate(lastPurchase)}</span>
        </Field>
        <Field icon={UserCircle2} label="Vendedor responsável" dense>
          <span className="text-xs font-medium">{sellerName || '—'}</span>
        </Field>
        <Field icon={Sparkles} label="Score IA" dense>
          {c.ai_score != null && c.ai_tier != null ? (
            <AIScoreBadge score={c.ai_score} tier={c.ai_tier} summary={c.ai_summary} size="sm" />
          ) : (
            <span className="text-xs font-medium">—</span>
          )}
        </Field>
        {isTravel && (
          <Field icon={Coins} label="Créditos de cancelamento" dense>
            <span className="text-base font-bold text-primary">{creditBalance > 0 ? fmtCurrency(creditBalance) : '—'}</span>
          </Field>
        )}
        {c.status === 'cliente' && (
          <NpsCard orgSlug={orgSlug} leadId={c.id} npsScore={c.nps_score ?? null} npsUpdatedAt={c.nps_updated_at ?? null} />
        )}
      </div>

      {/* Barra de ações principais */}
      <div className="flex flex-wrap gap-2">
        {c.phone && (
          <Button size="sm" variant="outline" asChild>
            <a href={`https://wa.me/${onlyDigits(c.phone)}`} target="_blank" rel="noopener noreferrer">
              <WhatsAppGlyph color="#25D366" /> <span className="ml-1.5">WhatsApp</span>
            </a>
          </Button>
        )}
        {c.phone && (
          <Button
            size="sm"
            variant="outline"
            disabled={openingConversation}
            onClick={onOpenConversation}
          >
            <WhatsAppGlyph color="#0a84ff" /> <span className="ml-1.5">Iniciar Waba</span>
          </Button>
        )}
        {c.phone && (
          <Button size="sm" variant="outline" className="hidden md:inline-flex" onClick={() => openDialer({ contatoId: c.id, name: c.name, phone: c.phone! })}>
            <PhoneCall className="w-4 h-4 mr-1.5" /> Ligar
          </Button>
        )}
        {c.email && (
          <SendEmailDialog orgSlug={orgSlug} lead={c} templates={selected.templates} org={{ name: orgName }} />
        )}
        <Button size="sm" variant="outline" onClick={onNewTask} className="hidden md:inline-flex">
          <Plus className="w-4 h-4 mr-1.5" /> Atividade
        </Button>
        {c.status === 'cliente' && (
          <Button size="sm" variant="outline" onClick={onReopen} disabled={reopening} className="hidden md:inline-flex">
            <RefreshCw className={cn('w-4 h-4 mr-1.5', reopening && 'animate-spin')} /> Nova negociação
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="px-2">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Só no mobile — no desktop essas ações já aparecem como botão solto acima. */}
            {c.phone && (
              <DropdownMenuItem className="md:hidden" onClick={() => openDialer({ contatoId: c.id, name: c.name, phone: c.phone! })}>
                <PhoneCall className="w-3.5 h-3.5 mr-2" /> Ligar
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onNewTask} className="md:hidden">
              <Plus className="w-3.5 h-3.5 mr-2" /> Atividade
            </DropdownMenuItem>
            {c.status === 'cliente' && (
              <DropdownMenuItem onClick={onReopen} disabled={reopening} className="md:hidden">
                <RefreshCw className="w-3.5 h-3.5 mr-2" /> Nova negociação
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="md:hidden" />
            <RequalifyButton orgSlug={orgSlug} leadId={c.id} asMenuItem />
            <DropdownMenuItem onClick={onEditDados}>
              <Pencil className="w-3.5 h-3.5 mr-2" /> Editar dados
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
              disabled={deleting}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir contato
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}
