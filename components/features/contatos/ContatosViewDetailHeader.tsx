'use client'

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
import { CONTATO_STATUS_META, contatoSourceLabel } from '@/lib/contatos'
import AIScoreBadge from '@/components/features/ai/AIScoreBadge'
import RequalifyButton from '@/components/features/ai/RequalifyButton'
import SendEmailDialog from '@/components/features/SendEmailDialog'
import { fmtCurrency, fmtDate, onlyDigits, STATUS_VALUES, type Selected } from './ContatosViewShared'
import { AvatarUploader } from './ContatosViewWidgets'
import { Field } from './ContatosViewDetailHelpers'
import { NpsCard } from './NpsSection'

export function DetailHeader({
  orgSlug, selected, c, onBack, isTravel, savingStatus, onChangeStatus,
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
            {(c.phone || c.email) && ' · '}
            Origem: {contatoSourceLabel(c.source)}
            {stageName ? ` · Funil: ${stageName}` : ''}
          </p>
          <div className="mt-2 w-44">
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
          <Button size="sm" variant="outline" asChild>
            <a href={`tel:${onlyDigits(c.phone)}`}>
              <PhoneCall className="w-4 h-4 mr-1.5" /> Ligar
            </a>
          </Button>
        )}
        {c.email && (
          <SendEmailDialog orgSlug={orgSlug} lead={c} templates={selected.templates} org={{ name: orgName }} />
        )}
        <Button size="sm" variant="outline" onClick={onNewTask}>
          <Plus className="w-4 h-4 mr-1.5" /> Atividade
        </Button>
        {c.status === 'cliente' && (
          <Button size="sm" variant="outline" onClick={onReopen} disabled={reopening}>
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
