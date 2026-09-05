'use client'

/**
 * The contact detail side panel for ContatosView, plus its two small
 * private helpers (ActivityRow, Field). Split out of ContatosView.tsx.
 */

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getOrCreateConversationForLead } from '@/actions/whatsapp'
import {
  setContatoStatus, reopenNegotiation, listContatoDeals, updateLeadTags, deleteLead, type ContatoDeal,
} from '@/actions/contatos'
import { listCreditsForContato, type TravelCreditRow } from '@/actions/travel-credits'
import TaskDialog from '@/components/features/TaskDialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { type Selected } from './ContatosViewShared'
import { DetailHeader } from './ContatosViewDetailHeader'
import { OverviewTab } from './ContatosViewDetailOverviewTab'
import { ActivitiesTab } from './ContatosViewDetailActivitiesTab'
import { NegociacoesTab, ComprasTab } from './ContatosViewDetailHistoryTabs'

export function DetailPanel({
  orgSlug, selected, onBack, members, isTravel, isRealEstate, properties = [], orgName, whatsappTemplates,
}: {
  orgSlug: string
  selected: NonNullable<Selected>
  onBack: () => void
  members: { id: string; name: string }[]
  isTravel: boolean
  isRealEstate?: boolean
  properties?: { id: string; title: string; code: string | null }[]
  orgName: string
  whatsappTemplates?: import('@/actions/whatsapp-templates').WaTemplate[]
}) {
  const router = useRouter()
  const c = selected.contato
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
      <DetailHeader
        orgSlug={orgSlug}
        selected={selected}
        c={c}
        onBack={onBack}
        isTravel={isTravel}
        savingStatus={savingStatus}
        onChangeStatus={changeStatus}
        tags={tags}
        tagInput={tagInput}
        setTagInput={setTagInput}
        onAddTag={addTag}
        onRemoveTag={removeTag}
        totalPurchased={totalPurchased}
        lastPurchase={lastPurchase}
        sellerName={sellerName}
        creditBalance={creditBalance}
        openingConversation={openingConversation}
        onOpenConversation={() => handleOpenConversation(c.id)}
        orgName={orgName}
        onNewTask={() => setNewTaskOpen(true)}
        reopening={reopening}
        onReopen={handleReopen}
        onEditDados={() => setDadosEditRequested(true)}
        deleting={deleting}
        onDelete={handleDelete}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="atividades">Atividades</TabsTrigger>
          <TabsTrigger value="negociacoes">Negociações</TabsTrigger>
          <TabsTrigger value="compras">Compras</TabsTrigger>
        </TabsList>

        {/* ── Visão geral ─────────────────────────────────────────── */}
        <TabsContent value="visao-geral" className="space-y-5 pt-4">
          <OverviewTab
            orgSlug={orgSlug}
            selected={selected}
            c={c}
            isTravel={isTravel}
            isRealEstate={isRealEstate}
            properties={properties}
            members={members}
            dadosEditRequested={dadosEditRequested}
            deals={deals}
            credits={credits}
            onShowAllDeals={() => setActiveTab('negociacoes')}
          />
        </TabsContent>

        {/* ── Atividades ──────────────────────────────────────────── */}
        <TabsContent value="atividades" className="space-y-5 pt-4">
          {/* 2x2: Tarefas/E-mails em cima, WhatsApp/Timeline embaixo. As duas
              listas (Tarefas, E-mails) ficam limitadas a ~10 itens visíveis,
              com scroll vertical próprio a partir daí. */}
          <ActivitiesTab
            orgSlug={orgSlug}
            selected={selected}
            c={c}
            orgName={orgName}
            onNewTask={() => setNewTaskOpen(true)}
          />
        </TabsContent>

        {/* ── Negociações ─────────────────────────────────────────── */}
        <TabsContent value="negociacoes" className="pt-4">
          <NegociacoesTab orgSlug={orgSlug} selected={selected} isTravel={isTravel} deals={deals} />
        </TabsContent>

        {/* ── Compras ─────────────────────────────────────────────── */}
        <TabsContent value="compras" className="pt-4">
          <ComprasTab orgSlug={orgSlug} selected={selected} isTravel={isTravel} />
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


export { DealCard } from './ContatosViewDetailHelpers'
