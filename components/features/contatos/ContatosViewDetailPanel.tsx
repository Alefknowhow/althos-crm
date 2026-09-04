'use client'

/**
 * The contact detail side panel for ContatosView, plus its two small
 * private helpers (ActivityRow, Field). Split out of ContatosView.tsx.
 */

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { getOrCreateConversationForLead } from '@/actions/whatsapp'
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
import {
  setContatoStatus, reopenNegotiation, listContatoDeals, updateLeadTags, deleteLead, type ContatoDeal,
} from '@/actions/contatos'
import { listCreditsForContato, type TravelCreditRow } from '@/actions/travel-credits'
import CustomerProfileForm from '@/components/features/customers/CustomerProfileForm'
import ContatoRelationships from '@/components/features/contatos/ContatoRelationships'
import PropertyInterestsSection from '@/components/features/properties/PropertyInterestsSection'
import PropertyVisitsSection from '@/components/features/properties/PropertyVisitsSection'
import PropertyPreferencesCard from '@/components/features/properties/PropertyPreferencesCard'
import PropertyMatchSuggestions from '@/components/features/properties/PropertyMatchSuggestions'
import AIScoreBadge from '@/components/features/ai/AIScoreBadge'
import RequalifyButton from '@/components/features/ai/RequalifyButton'
import SendEmailDialog from '@/components/features/SendEmailDialog'
import SendCustomEmailDialog from '@/components/features/SendCustomEmailDialog'
import TaskCard from '@/components/features/TaskCard'
import TaskDialog from '@/components/features/TaskDialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { fmtCurrency, fmtDate, onlyDigits, STATUS_VALUES, type Selected } from './ContatosViewShared'
import { AvatarUploader } from './ContatosViewWidgets'

export function DetailPanel({
  orgSlug, selected, onBack, members, isTravel, isRealEstate, properties = [], orgName,
}: {
  orgSlug: string
  selected: NonNullable<Selected>
  onBack: () => void
  members: { id: string; name: string }[]
  isTravel: boolean
  isRealEstate?: boolean
  properties?: { id: string; title: string; code: string | null }[]
  orgName: string
}) {
  const router = useRouter()
  const c = selected.contato
  const stageName = c.pipeline_stages?.name as string | undefined
  const sellerName = c.assigned_to ? members.find(m => m.id === c.assigned_to)?.name : null
  const [savingStatus, startStatus] = useTransition()
  const [reopening, startReopen] = useTransition()
  const [deleting, startDelete] = useTransition()
  const [deals, setDeals] = useState<ContatoDeal[]>([])
  const [credits, setCredits] = useState<TravelCreditRow[]>([])
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('visao-geral')
  const [dadosEditRequested, setDadosEditRequested] = useState(false)
  const [openingConversation, setOpeningConversation] = useState(false)

  async function handleOpenConversation(contatoId: string) {
    if (openingConversation) return
    setOpeningConversation(true)
    const res = await getOrCreateConversationForLead(orgSlug, contatoId)
    setOpeningConversation(false)
    if (!res.ok) { toast.error(res.error); return }
    router.push(`/app/${orgSlug}/conversas?id=${res.conversationId}`)
  }

  // Nicho viagens: "Total comprado" soma as reservas (travel_sales), não a
  // tabela genérica `sales` (que fica sempre vazia nesse nicho — Compras já
  // usa a mesma fonte, ver aba Compras acima).
  const completedSales = selected.sales.filter(s => s.status === 'completed')
  const travelReservasValid = (selected.travelReservas || []).filter((r: any) => r.status !== 'cancelled')
  const totalPurchased = isTravel
    ? travelReservasValid.reduce((a: number, r: any) => a + (r.total_cents || 0), 0)
    : completedSales.reduce((a, s) => a + (s.amount_cents || 0), 0)
  const lastPurchase = isTravel
    ? (travelReservasValid[0]?.created_at || null)
    : (completedSales[0]?.sale_date || null)

  useEffect(() => {
    let active = true
    if (c.status === 'cliente') {
      listContatoDeals(orgSlug, c.id).then(d => { if (active) setDeals(d) })
    } else {
      setDeals([])
    }
    return () => { active = false }
  }, [orgSlug, c.id, c.status])

  useEffect(() => {
    let active = true
    if (isTravel) {
      listCreditsForContato(orgSlug, c.id).then(cr => { if (active) setCredits(cr) })
    } else {
      setCredits([])
    }
    return () => { active = false }
  }, [orgSlug, c.id, isTravel])

  const creditBalance = credits.reduce((a, cr) => a + (cr.status === 'available' ? cr.valor_cents - cr.valor_usado_cents : 0), 0)

  function changeStatus(value: string) {
    startStatus(async () => {
      const res = await setContatoStatus(orgSlug, c.id, value)
      if (!res.ok) { toast.error(res.error); return }
      toast.success('Classificação atualizada.')
      router.refresh()
    })
  }

  function handleDelete() {
    if (!window.confirm('Excluir este contato? Essa ação não pode ser desfeita — o contato e todas as suas atividades serão perdidos.')) return
    startDelete(async () => {
      const res = await deleteLead(orgSlug, c.id)
      if (!res.ok) { toast.error(res.error || 'Erro ao excluir contato'); return }
      toast.success('Contato excluído.')
      router.push(`/app/${orgSlug}/contatos`)
    })
  }

  function handleReopen() {
    if (!window.confirm('Arquivar a negociação atual e voltar esse cliente pro início do funil?')) return
    startReopen(async () => {
      const res = await reopenNegotiation(orgSlug, c.id)
      if (!res.ok) { toast.error(res.error); return }
      toast.success('Nova negociação iniciada.')
      router.refresh()
    })
  }

  const [tags, setTags] = useState<string[]>(Array.isArray(c.tags) ? c.tags : [])
  const [tagInput, setTagInput] = useState('')
  async function saveTags(next: string[]) {
    setTags(next)
    const res = await updateLeadTags(orgSlug, c.id, next)
    if (!res.ok) toast.error(res.error)
  }
  function addTag() {
    const v = tagInput.trim()
    if (!v || tags.includes(v)) { setTagInput(''); return }
    setTagInput('')
    saveTags([...tags, v])
  }
  function removeTag(t: string) {
    saveTags(tags.filter(x => x !== t))
  }


  return (
    <div className="p-5 sm:p-6 space-y-5">
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
            <Select value={(c.status as string) || 'lead'} onValueChange={changeStatus} disabled={savingStatus}>
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
            <button type="button" onClick={() => removeTag(t)} aria-label={`Remover tag ${t}`} className="hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        <Input
          value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
          onBlur={addTag}
          placeholder="+ tag"
          className="h-6 w-20 text-[11px] px-2 bg-background"
        />
      </div>

      {/* Cards de resumo — compactos, logo abaixo das tags */}
      <div className={cn('grid grid-cols-2 gap-2', isTravel ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
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
            onClick={() => handleOpenConversation(c.id)}
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
        <Button size="sm" variant="outline" onClick={() => setNewTaskOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Atividade
        </Button>
        {c.status === 'cliente' && (
          <Button size="sm" variant="outline" onClick={handleReopen} disabled={reopening}>
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
            <DropdownMenuItem onClick={() => setDadosEditRequested(true)}>
              <Pencil className="w-3.5 h-3.5 mr-2" /> Editar dados
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir contato
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="atividades">Atividades</TabsTrigger>
          <TabsTrigger value="negociacoes">Negociações</TabsTrigger>
          <TabsTrigger value="compras">Compras</TabsTrigger>
        </TabsList>

        {/* ── Visão geral ─────────────────────────────────────────── */}
        <TabsContent value="visao-geral" className="space-y-5 pt-4">
          {/* Cadastro do Cliente — incorporado à Visão geral, no topo da aba */}
          <CustomerProfileForm
            orgSlug={orgSlug}
            leadId={c.id}
            initial={c}
            initialContactPoints={selected.contactPoints}
            initialDocuments={selected.documents}
            initialEditMode={dadosEditRequested}
          />

          {/* Parentesco */}
          <ContatoRelationships orgSlug={orgSlug} contatoId={c.id} initial={selected.relationships} />

          {/* Negociações (resumo) */}
          {deals.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Negociações
                </p>
                {deals.length > 2 && (
                  <button type="button" className="text-xs text-primary hover:underline" onClick={() => setActiveTab('negociacoes')}>
                    ver todas
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {deals.slice(0, 2).map(d => <DealCard key={d.id} d={d} fmtCurrency={fmtCurrency} fmtDate={fmtDate} />)}
              </div>
            </div>
          )}

          {/* Créditos de Cancelamento (Viagens) — resumo já vira card na linha
              de topo; aqui só o detalhamento por crédito, quando existir. */}
          {isTravel && credits.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                Detalhamento dos créditos
              </p>
              <div className="space-y-1.5">
                {credits.map(cr => {
                    const saldo = cr.valor_cents - cr.valor_usado_cents
                    const statusLabel = cr.status === 'used' ? 'Utilizado' : cr.status === 'cancelled' ? 'Cancelado' : cr.validade && new Date(cr.validade) < new Date() ? 'Expirado' : 'Disponível'
                    return (
                      <div key={cr.id} className="border rounded-lg px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{cr.operadora}</span>
                          <span className="font-semibold tabular-nums">{fmtCurrency(saldo)}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>{fmtDate(cr.data_emissao)}</span>
                          {cr.validade && <span>· Válido até {fmtDate(cr.validade)}</span>}
                          <Badge variant="outline" className="text-[9px] px-1 py-0">{statusLabel}</Badge>
                          {cr.origem_sale_id && (
                            <Link href={`/app/${orgSlug}/reservas?sale=${cr.origem_sale_id}`} className="text-primary hover:underline">
                              Ver venda de origem
                            </Link>
                          )}
                        </div>
                        {cr.observacoes && <div className="text-xs text-muted-foreground mt-1">{cr.observacoes}</div>}
                      </div>
                    )
                  })}
                </div>
            </div>
          )}

          {/* Imóveis de interesse / Visitas — só nicho imobiliário */}
          {isRealEstate && (
            <>
              <PropertyInterestsSection orgSlug={orgSlug} mode={{ type: 'contato', contatoId: c.id }} initial={selected.propertyInterests || []} properties={properties} />
              <PropertyVisitsSection orgSlug={orgSlug} mode={{ type: 'contato', contatoId: c.id }} initial={selected.propertyVisits || []} properties={properties} members={members.map(m => ({ user_id: m.id, name: m.name }))} />
              <PropertyPreferencesCard orgSlug={orgSlug} contatoId={c.id} initial={selected.propertyPreferences || null} />
              <PropertyMatchSuggestions orgSlug={orgSlug} contatoId={c.id} />
            </>
          )}
        </TabsContent>

        {/* ── Atividades ──────────────────────────────────────────── */}
        <TabsContent value="atividades" className="space-y-5 pt-4">
          {/* 2x2: Tarefas/E-mails em cima, WhatsApp/Timeline embaixo. As duas
              listas (Tarefas, E-mails) ficam limitadas a ~10 itens visíveis,
              com scroll vertical próprio a partir daí. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="border rounded-lg p-3 space-y-3 min-h-[220px] flex flex-col">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Tarefas</p>
                <Button type="button" size="sm" variant="outline" onClick={() => setNewTaskOpen(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Nova tarefa
                </Button>
              </div>
              {selected.tasks.length > 0 ? (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {selected.tasks.map((task: any) => (
                    <TaskCard key={task.id} task={task} orgSlug={orgSlug} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg flex-1 flex items-center justify-center">Nenhuma tarefa vinculada.</p>
              )}
            </div>

            <div className="border rounded-lg p-3 space-y-3 min-h-[220px] flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">E-mails</p>
                {/* Sempre visíveis — sem e-mail cadastrado, os próprios
                    diálogos avisam "Sem e-mail" e desabilitam o envio, em
                    vez de esconder o botão inteiro. */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <SendEmailDialog
                    orgSlug={orgSlug}
                    lead={c}
                    templates={selected.templates}
                    org={{ name: orgName }}
                    trigger={<Button type="button" size="sm" variant="outline">Disparar template</Button>}
                  />
                  <SendCustomEmailDialog
                    orgSlug={orgSlug}
                    lead={c}
                    trigger={<Button type="button" size="sm" variant="outline">Enviar e-mail</Button>}
                  />
                </div>
              </div>
              {selected.emailSends.length > 0 ? (
                <div className="max-h-[420px] overflow-y-auto border rounded-lg divide-y">
                  {selected.emailSends.map((es: any) => (
                    <div key={es.id} className="flex justify-between items-center px-3 py-2.5">
                      <div>
                        <div className="text-sm font-medium">{(Array.isArray(es.email_templates) ? es.email_templates[0]?.name : es.email_templates?.name) || 'E-mail avulso'}</div>
                        <div className="text-[11px] text-muted-foreground">{new Date(es.created_at).toLocaleString('pt-BR')}</div>
                      </div>
                      <Badge variant={es.status === 'sent' ? 'default' : es.status === 'opened' ? 'secondary' : es.status === 'failed' || es.status === 'bounced' ? 'destructive' : 'outline'}>{es.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg flex-1 flex items-center justify-center">Nenhum e-mail enviado.</p>
              )}
            </div>

            <div className="border rounded-lg p-3 space-y-3 min-h-[220px] flex flex-col">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">WhatsApp</p>
              {selected.whatsappConv ? (
                <div className="text-sm border rounded-lg p-3 bg-muted/20 flex flex-col items-center justify-center text-center gap-1.5">
                  <div className="font-semibold">{selected.whatsappConv.contact_name || selected.whatsappConv.contact_phone}</div>
                  <div className="text-muted-foreground text-xs">{selected.whatsappConv.contact_phone}</div>
                  <div className="text-[11px] mt-1 bg-primary/10 text-primary px-2 py-1 rounded-full">
                    Última interação: {fmtDate(selected.whatsappConv.last_message_at)}
                  </div>
                  <Link href={`/app/${orgSlug}/conversas?id=${selected.whatsappConv.id}`} className="flex w-full">
                    <Button className="w-full bg-[#25D366] hover:bg-[#1DA851] text-white">Abrir Conversa WhatsApp</Button>
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg flex-1 flex items-center justify-center">Sem conversa vinculada.</p>
              )}
            </div>

            <div className="border rounded-lg p-3 space-y-3 min-h-[220px] flex flex-col">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Timeline</p>
              {selected.activities.length > 0 ? (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {selected.activities.map((act: any) => <ActivityRow key={act.id} act={act} fmtCurrency={fmtCurrency} />)}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg flex-1 flex items-center justify-center">Nenhuma atividade registrada.</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Negociações ─────────────────────────────────────────── */}
        {/* Nicho viagens: cotações (travel_proposals) ligadas ao lead, não o
            histórico genérico de negocios (que é sobre movimento de pipeline,
            não sobre o que foi efetivamente proposto ao cliente). */}
        <TabsContent value="negociacoes" className="pt-4">
          {isTravel ? (
            (selected.travelCotacoes || []).length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Cotação</th>
                      <th className="text-left font-medium px-3 py-2">Período</th>
                      <th className="text-right font-medium px-3 py-2">Valor</th>
                      <th className="text-left font-medium px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(selected.travelCotacoes || []).map((p: any) => (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">
                          <Link href={`/app/${orgSlug}/cotacoes/${p.id}`} className="hover:underline">
                            {p.title || 'Cotação'}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {p.start_date ? `${fmtDate(p.start_date)} – ${fmtDate(p.end_date)}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtCurrency(p.total_cents || 0)}</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{p.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">Nenhuma cotação registrada.</p>
            )
          ) : deals.length > 0 ? (
            <div className="space-y-2">
              {deals.map(d => <DealCard key={d.id} d={d} fmtCurrency={fmtCurrency} fmtDate={fmtDate} />)}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">Nenhuma negociação registrada.</p>
          )}
        </TabsContent>

        {/* ── Compras ─────────────────────────────────────────────── */}
        {/* Nicho viagens: reservas (travel_sales), não a tabela genérica
            `sales` (que é de outros nichos e fica sempre vazia aqui). */}
        <TabsContent value="compras" className="pt-4">
          {isTravel ? (
            (selected.travelReservas || []).length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Data</th>
                      <th className="text-left font-medium px-3 py-2">Destino</th>
                      <th className="text-right font-medium px-3 py-2">Valor</th>
                      <th className="text-left font-medium px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(selected.travelReservas || []).map((s: any) => (
                      <tr key={s.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 text-muted-foreground">{fmtDate(s.created_at)}</td>
                        <td className="px-3 py-2 font-medium">
                          <Link href={`/app/${orgSlug}/reservas?sale=${s.id}`} className="hover:underline">
                            {s.destination || s.package_locator || s.sale_number || 'Reserva'}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtCurrency(s.total_cents || 0)}</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{s.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">Nenhuma reserva registrada.</p>
            )
          ) : selected.sales.length > 0 ? (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Data</th>
                    <th className="text-left font-medium px-3 py-2">Produto</th>
                    <th className="text-right font-medium px-3 py-2">Valor</th>
                    <th className="text-left font-medium px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selected.sales.map(s => (
                    <tr key={s.id}>
                      <td className="px-3 py-2 text-muted-foreground">{fmtDate(s.sale_date)}</td>
                      <td className="px-3 py-2 font-medium">{s.products?.name || 'Venda'}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtCurrency(s.amount_cents)}</td>
                      <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{s.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">Nenhuma compra registrada.</p>
          )}
        </TabsContent>

      </Tabs>

      <TaskDialog
        orgSlug={orgSlug}
        defaultLead={{ id: c.id, name: c.name }}
        trigger={<button type="button" className="hidden" aria-hidden />}
        open={newTaskOpen}
        onOpenChange={(v: boolean) => setNewTaskOpen(v)}
      />
    </div>
  )
}

function ActivityRow({ act, fmtCurrency }: { act: any; fmtCurrency: (v: number) => string }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs">
        {act.type === 'manual_created' ? '🚀' : act.type === 'note' ? '📝' : act.type === 'ai_qualified' ? '✨' : act.type.startsWith('email') ? '✉️' : act.type.startsWith('credit_') ? '🎫' : '⚙️'}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium">
          {act.type === 'manual_created' ? 'Contato criado manualmente'
            : act.type === 'note' ? 'Nota adicionada'
            : act.type === 'ai_qualified' ? `IA qualificou: ${act.payload?.tier?.toUpperCase()} (${act.payload?.score}/100)`
            : act.type === 'email_sent' ? 'E-mail enviado'
            : act.type === 'email_opened' ? 'E-mail aberto'
            : act.type === 'credit_created' ? `Crédito de cancelamento gerado: ${fmtCurrency(act.payload?.valor_cents || 0)} (${act.payload?.operadora})`
            : act.type === 'credit_used' ? `Crédito de cancelamento utilizado: ${fmtCurrency(act.payload?.valor_cents || 0)}`
            : act.type}
        </div>
        {act.type === 'note' && <div className="text-sm mt-1 whitespace-pre-wrap">{act.payload.text}</div>}
        {act.type === 'ai_qualified' && (
          <div className="text-xs mt-1 text-muted-foreground italic">
            {act.payload?.reason}
            {act.payload?.concerns?.length > 0 && <div className="mt-1">⚠ {act.payload.concerns.join(' · ')}</div>}
          </div>
        )}
        {act.type === 'email_sent' && <div className="text-xs mt-1 text-muted-foreground">Assunto: {act.payload.subject} (Template: {act.payload.template_name})</div>}
        <div className="text-[11px] text-muted-foreground mt-1">{new Date(act.created_at).toLocaleString('pt-BR')}</div>
      </div>
    </div>
  )
}

export function DealCard({ d, fmtCurrency, fmtDate }: { d: ContatoDeal; fmtCurrency: (v: number) => string; fmtDate: (v: string | null) => string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm border rounded-lg px-3 py-2">
      <div className="min-w-0">
        <span className={cn(
          'font-medium',
          d.status === 'won' && 'text-emerald-600',
          d.status === 'lost' && 'text-muted-foreground',
        )}>
          {d.status === 'won' ? 'Ganho' : d.status === 'lost' ? 'Perdido' : 'Em aberto'}
        </span>
        {d.stage_name && <span className="text-muted-foreground"> · {d.stage_name}</span>}
        <div className="text-xs text-muted-foreground">
          {fmtDate(d.won_at || d.lost_at || d.created_at)}
        </div>
      </div>
      <span className="font-semibold tabular-nums shrink-0">{fmtCurrency(d.value_cents || 0)}</span>
    </div>
  )
}


function Field({ icon: Icon, label, children, dense }: { icon: any; label: string; children: React.ReactNode; dense?: boolean }) {
  return (
    <div className={cn('rounded-lg border bg-background space-y-1', dense ? 'p-2' : 'p-3')}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className={dense ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        <span className={cn('font-bold uppercase tracking-wider', dense ? 'text-[9px]' : 'text-[10px]')}>{label}</span>
      </div>
      {children}
    </div>
  )
}
