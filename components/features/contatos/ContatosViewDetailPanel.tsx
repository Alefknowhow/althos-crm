'use client'

/**
 * Painel do cliente — página cheia (não é mais um painel lateral dividido
 * com a lista). Estrutura: coluna esquerda de perfil (ContatosViewDetailSidebar)
 * + coluna direita com abas, KPIs e linha do tempo, igual ao artboard 26.
 */

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronLeft, MoreVertical, Plus, RefreshCw, Trash2, Wallet, CalendarClock, Radio } from 'lucide-react'
import { getOrCreateConversationForLead } from '@/actions/whatsapp'
import {
  setContatoStatus, setContatoSource, reopenNegotiation, listContatoDeals, updateLeadTags, deleteLead, type ContatoDeal,
} from '@/actions/contatos'
import { listCreditsForContato, type TravelCreditRow } from '@/actions/travel-credits'
import TaskDialog from '@/components/features/TaskDialog'
import RequalifyButton from '@/components/features/ai/RequalifyButton'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { fmtCurrency, fmtDate, type Selected } from './ContatosViewShared'
import { DetailSidebar } from './ContatosViewDetailSidebar'
import { OverviewTab } from './ContatosViewDetailOverviewTab'
import { ActivitiesTab } from './ContatosViewDetailActivitiesTab'
import { NegociacoesTab, ComprasTab } from './ContatosViewDetailHistoryTabs'
import { ActivityRow } from './ContatosViewDetailHelpers'

const TABS = [
  { key: 'visao-geral', label: 'Visão geral' },
  { key: 'atividades', label: 'Atividades' },
  { key: 'negocios', label: 'Negócios' },
  { key: 'documentos', label: 'Documentos' },
] as const

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
  const sellerName = c.assigned_to ? members.find(m => m.id === c.assigned_to)?.name : null
  const [savingStatus, startStatus] = useTransition()
  const [savingSource, startSource] = useTransition()
  const [reopening, startReopen] = useTransition()
  const [deleting, startDelete] = useTransition()
  const [deals, setDeals] = useState<ContatoDeal[]>([])
  const [credits, setCredits] = useState<TravelCreditRow[]>([])
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<typeof TABS[number]['key']>('visao-geral')
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
  // usa a mesma fonte, ver aba Documentos acima).
  const completedSales = selected.sales.filter(s => s.status === 'completed')
  const travelReservasValid = (selected.travelReservas || []).filter((r: any) => r.status !== 'cancelled')
  const totalPurchased = isTravel
    ? travelReservasValid.reduce((a: number, r: any) => a + (r.total_cents || 0), 0)
    : completedSales.reduce((a, s) => a + (s.amount_cents || 0), 0)
  const lastActivity = selected.activities[0]?.created_at || c.last_activity_at

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
  const openDeals = deals.filter(d => d.status !== 'won' && d.status !== 'lost').length

  function changeStatus(value: string) {
    startStatus(async () => {
      const res = await setContatoStatus(orgSlug, c.id, value)
      if (!res.ok) { toast.error(res.error); return }
      toast.success('Classificação atualizada.')
      router.refresh()
    })
  }

  function changeSource(value: { source: string; referred_by_contato_id?: string | null; referred_by_name?: string | null }) {
    startSource(async () => {
      const res = await setContatoSource(orgSlug, c.id, value)
      if (!res.ok) { toast.error(res.error); return }
      toast.success('Origem atualizada.')
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
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar para Contatos
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="w-8 h-8 grid place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setNewTaskOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-2" /> Nova atividade
            </DropdownMenuItem>
            {c.status === 'cliente' && (
              <DropdownMenuItem onClick={handleReopen} disabled={reopening}>
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${reopening ? 'animate-spin' : ''}`} /> Nova negociação
              </DropdownMenuItem>
            )}
            <RequalifyButton orgSlug={orgSlug} leadId={c.id} asMenuItem />
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleDelete} disabled={deleting}>
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir contato
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        <DetailSidebar
          orgSlug={orgSlug}
          selected={selected}
          c={c}
          isTravel={isTravel}
          sellerName={sellerName}
          creditBalance={creditBalance}
          savingStatus={savingStatus}
          onChangeStatus={changeStatus}
          savingSource={savingSource}
          onChangeSource={changeSource}
          tags={tags}
          tagInput={tagInput}
          setTagInput={setTagInput}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          openingConversation={openingConversation}
          onOpenConversation={() => handleOpenConversation(c.id)}
        />

        <div className="flex-1 min-w-0">
          {/* Abas — pílula, igual ao resto do design system */}
          <div className="flex gap-1 p-1 rounded-full bg-muted w-fit mb-5 overflow-x-auto max-w-full">
            {TABS.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`shrink-0 h-8 px-4 rounded-full text-[13px] font-semibold transition-colors ${
                  activeTab === t.key ? 'bg-card shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'visao-geral' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <VisaoKpi icon={Wallet} label="Total comprado" value={fmtCurrency(totalPurchased)} />
                <VisaoKpi icon={CalendarClock} label="Negócios abertos" value={String(openDeals)} />
                <VisaoKpi icon={Radio} label="Última interação" value={lastActivity ? fmtDate(lastActivity) : '—'} />
              </div>

              <div className="rounded-lg bg-card p-4">
                <h3 className="text-sm font-bold mb-3">Linha do tempo</h3>
                {selected.activities.length > 0 ? (
                  <div className="space-y-4">
                    {selected.activities.slice(0, 8).map((act: any) => <ActivityRow key={act.id} act={act} fmtCurrency={fmtCurrency} />)}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhuma atividade registrada.</p>
                )}
              </div>

              <OverviewTab
                orgSlug={orgSlug}
                selected={selected}
                c={c}
                isTravel={isTravel}
                isRealEstate={isRealEstate}
                properties={properties}
                members={members}
                deals={deals}
                credits={credits}
                onShowAllDeals={() => setActiveTab('negocios')}
              />
            </div>
          )}

          {activeTab === 'atividades' && (
            <ActivitiesTab
              orgSlug={orgSlug}
              selected={selected}
              c={c}
              orgName={orgName}
              onNewTask={() => setNewTaskOpen(true)}
            />
          )}

          {activeTab === 'negocios' && (
            <NegociacoesTab orgSlug={orgSlug} selected={selected} isTravel={isTravel} deals={deals} />
          )}

          {activeTab === 'documentos' && (
            <ComprasTab orgSlug={orgSlug} selected={selected} isTravel={isTravel} />
          )}
        </div>
      </div>

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

function VisaoKpi({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-card p-3.5">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  )
}

export { DealCard } from './ContatosViewDetailHelpers'
