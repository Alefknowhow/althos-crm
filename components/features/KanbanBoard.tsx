'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import KanbanColumn from './KanbanColumn'
import LeadCard, { type CardMember } from './LeadCard'
import MobilePipelineList from './pipeline/MobilePipelineList'
import PipelineListView from './pipeline/PipelineListView'
import CurrencyInput from './pipeline/CurrencyInput'
import { moveLeadToStage } from '@/actions/contatos'
import LeadDetailDrawer from './LeadDetailDrawer'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LostMoveDialog, WonValueDialog, NegotiationValueDialog, isNegotiationStage } from './pipeline/StageMoveDialogs'
import { createLead } from '@/actions/contatos'
import { toast } from 'sonner'
import { traduzirErro } from '@/lib/utils/error-translator'
import { Search, AlarmClock, X, LayoutGrid, List } from 'lucide-react'
import { cn } from '@/lib/utils'

type Member = { id: string; name: string; email: string }
type SortKey = 'recent' | 'value_desc' | 'name'

function tierBucket(t?: string | null): 'hot' | 'warm' | 'cold' | null {
  const v = (t || '').toLowerCase()
  if (v === 'hot' || v === 'quente') return 'hot'
  if (v === 'warm' || v === 'morno') return 'warm'
  if (v === 'cold' || v === 'frio') return 'cold'
  return null
}

export default function KanbanBoard({
  orgSlug,
  initialStages,
  initialLeads,
  members = [],
  toolbarStart,
  staleDays = 7,
}: {
  orgSlug: string
  initialStages: any[]
  initialLeads: any[]
  members?: Member[]
  /** Botões extras (switcher/config de pipeline) renderizados no início da barra de filtros. */
  toolbarStart?: React.ReactNode
  /** Dias sem atividade pra um lead ser considerado "parado" (org_settings.stale_lead_days). */
  staleDays?: number
}) {
  const [stages, setStages] = useState(initialStages)
  const [leads, setLeads] = useState(initialLeads)
  const [activeLead, setActiveLead] = useState<any | null>(null)
  const [dragStartStageId, setDragStartStageId] = useState<string | null>(null)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [createStageId, setCreateStageId] = useState<string | null>(null)
  const [newLeadSource, setNewLeadSource] = useState('manual')
  const [loading, setLoading] = useState(false)

  // Filters / sort
  const [search, setSearch] = useState('')
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [stalledOnly, setStalledOnly] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('recent')

  // View mode
  const [view, setView] = useState<'board' | 'list'>('board')

  useEffect(() => {
    setStages(initialStages)
    setLeads(initialLeads)
  }, [initialStages, initialLeads])

  const membersById = useMemo<Record<string, CardMember>>(() => {
    const map: Record<string, CardMember> = {}
    for (const m of members) map[m.id] = m
    return map
  }, [members])

  const stagesById = useMemo<Record<string, any>>(() => {
    const map: Record<string, any> = {}
    for (const s of stages) map[s.id] = s
    return map
  }, [stages])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // ── Filtering + sorting (display only; dnd still uses full `leads`) ───────────
  const filtersActive =
    search.trim() !== '' || ownerFilter !== 'all' || tierFilter !== 'all' || stalledOnly

  const visibleLeads = useMemo(() => {
    const q = search.trim().toLowerCase()
    let out = leads.filter(l => {
      if (q) {
        const hay = `${l.name || ''} ${l.email || ''} ${l.phone || ''} ${(l.tags || []).join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (ownerFilter !== 'all') {
        if (ownerFilter === 'unassigned' ? !!l.assigned_to : l.assigned_to !== ownerFilter) return false
      }
      if (tierFilter !== 'all' && tierBucket(l.ai_tier) !== tierFilter) return false
      if (stalledOnly) {
        const ref = l.last_activity_at || l.updated_at
        if (!ref || Date.now() - new Date(ref).getTime() <= staleDays * 24 * 60 * 60 * 1000) return false
      }
      return true
    })

    out = [...out].sort((a, b) => {
      if (sortKey === 'value_desc') return (b.value_cents || 0) - (a.value_cents || 0)
      if (sortKey === 'name') return String(a.name).localeCompare(String(b.name))
      // recent
      const ra = new Date(a.last_activity_at || a.updated_at || 0).getTime()
      const rb = new Date(b.last_activity_at || b.updated_at || 0).getTime()
      return rb - ra
    })
    return out
  }, [leads, search, ownerFilter, tierFilter, stalledOnly, sortKey])

  function clearFilters() {
    setSearch('')
    setOwnerFilter('all')
    setTierFilter('all')
    setStalledOnly(false)
  }

  // ── DnD ───────────────────────────────────────────────────────────────────────
  function handleDragStart(event: any) {
    const lead = leads.find(l => l.id === event.active.id)
    if (lead) {
      setActiveLead(lead)
      setDragStartStageId(lead.stage_id)
    }
  }

  function handleDragOver(event: any) {
    const { active, over } = event
    if (!over) return
    const activeId = active.id
    const overId = over.id
    const isActiveLead = leads.some(l => l.id === activeId)
    const isOverColumn = stages.some(s => s.id === overId)
    const isOverLead = leads.some(l => l.id === overId)
    if (!isActiveLead) return

    if (isOverColumn || isOverLead) {
      setLeads(prevLeads => {
        const activeIndex = prevLeads.findIndex(l => l.id === activeId)
        if (activeIndex === -1) return prevLeads
        const al = prevLeads[activeIndex]
        let newStageId = al.stage_id
        if (isOverColumn) newStageId = overId
        else if (isOverLead) {
          const overIndex = prevLeads.findIndex(l => l.id === overId)
          newStageId = prevLeads[overIndex].stage_id
        }
        if (al.stage_id !== newStageId) {
          return prevLeads.map(l => (l.id === activeId ? { ...l, stage_id: newStageId } : l))
        }
        return prevLeads
      })
    }
  }

  // ── Movimentação de estágio (compartilhada por drag-and-drop e seletor) ────────
  // Ao cair numa etapa is_lost/is_won/"Negociação", pede uma confirmação
  // (motivo ou valor) antes de efetivar — o card já foi movido
  // otimisticamente, mas só chama o servidor após a escolha.
  const [lostMovePrompt, setLostMovePrompt] = useState<{ leadId: string; newStageId: string; oldStageId: string } | null>(null)
  const [wonMovePrompt, setWonMovePrompt] = useState<{ leadId: string; newStageId: string; oldStageId: string; defaultCents: number } | null>(null)
  const [negotiationMovePrompt, setNegotiationMovePrompt] = useState<{ leadId: string; newStageId: string; oldStageId: string; defaultCents: number } | null>(null)

  async function commitStageMove(
    leadId: string,
    newStageId: string,
    oldStageId: string,
    closeInfo?: { dealStatus: 'perdido' | 'desqualificado'; reason: string },
    valueCents?: number,
  ) {
    const res = await moveLeadToStage(orgSlug, leadId, newStageId, oldStageId, closeInfo, valueCents)
    if (!res.ok) {
      setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, stage_id: oldStageId } : l)))
      toast.error(traduzirErro(res.error, 'Erro ao mover lead'))
    } else if (valueCents != null) {
      setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, value_cents: valueCents } : l)))
    }
  }

  function requestStageMove(leadId: string, newStageId: string, oldStageId: string) {
    const stage = stagesById[newStageId]
    const lead = leads.find(l => l.id === leadId)
    if (stage?.is_lost) {
      setLostMovePrompt({ leadId, newStageId, oldStageId })
      return
    }
    if (stage?.is_won) {
      setWonMovePrompt({ leadId, newStageId, oldStageId, defaultCents: lead?.value_cents || 0 })
      return
    }
    if (isNegotiationStage(stage)) {
      setNegotiationMovePrompt({ leadId, newStageId, oldStageId, defaultCents: lead?.value_cents || 0 })
      return
    }
    commitStageMove(leadId, newStageId, oldStageId)
  }

  // ── Direct stage change from a card's stage picker ─────────────────────────────
  async function handleStageChange(leadId: string, newStageId: string) {
    const lead = leads.find(l => l.id === leadId)
    if (!lead || lead.stage_id === newStageId) return
    const oldStageId = lead.stage_id
    setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, stage_id: newStageId } : l)))
    requestStageMove(leadId, newStageId, oldStageId)
  }

  async function handleDragEnd(event: any) {
    const { active, over } = event
    setActiveLead(null)
    const oldStageId = dragStartStageId
    setDragStartStageId(null)
    if (!over) return
    const activeId = active.id
    const lead = leads.find(l => l.id === activeId)
    if (!lead) return
    if (lead.stage_id !== oldStageId && oldStageId) {
      requestStageMove(activeId, lead.stage_id, oldStageId)
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {toolbarStart}

        {/* Board / list view toggle — desktop only (mobile uses the stage accordion) */}
        <div className="hidden md:inline-flex h-9 items-center rounded-md border border-border p-0.5">
          <button
            type="button"
            onClick={() => setView('board')}
            title="Visualizar em quadro"
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-sm transition-colors',
              view === 'board' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Quadro</span>
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            title="Visualizar em lista"
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-sm transition-colors',
              view === 'list' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Lista</span>
          </button>
        </div>

        {members.length > 0 && (
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos responsáveis</SelectItem>
              <SelectItem value="unassigned">Sem responsável</SelectItem>
              {members.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.name || m.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Temperatura" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas IA</SelectItem>
            <SelectItem value="hot">🔥 Quente</SelectItem>
            <SelectItem value="warm">🟡 Morno</SelectItem>
            <SelectItem value="cold">🔵 Frio</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortKey} onValueChange={v => setSortKey(v as SortKey)}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="value_desc">Maior valor</SelectItem>
            <SelectItem value="name">Nome (A-Z)</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative min-w-[180px] flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar negócios…"
            className="h-9 pl-9"
          />
        </div>

        <button
          type="button"
          onClick={() => setStalledOnly(v => !v)}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors',
            stalledOnly
              ? 'border-amber-300 bg-amber-50 text-amber-700'
              : 'border-border text-muted-foreground hover:bg-secondary',
          )}
        >
          <AlarmClock className="h-4 w-4" />
          Parados
        </button>

        {filtersActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
            Limpar
          </button>
        )}
      </div>

      {/* Mobile — stage accordion (replaces board/list on small screens) */}
      <div className="flex md:hidden flex-1 min-h-0">
        <MobilePipelineList
          stages={stages}
          leads={visibleLeads}
          orgSlug={orgSlug}
          membersById={membersById}
          onLeadClick={id => setSelectedLeadId(id)}
          onAddLead={id => setCreateStageId(id)}
          staleDays={staleDays}
        />
      </div>

      {/* Desktop — board / list */}
      <div className="hidden md:flex md:flex-1 md:flex-col md:min-h-0">
      {view === 'board' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto pb-2 md:flex-row md:overflow-x-auto md:overflow-y-hidden md:snap-x hide-scrollbar">
            {stages.map(stage => {
              const stageLeads = visibleLeads.filter(l => l.stage_id === stage.id)
              return (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  leads={stageLeads}
                  orgSlug={orgSlug}
                  membersById={membersById}
                  members={members}
                  stages={stages}
                  onStageChange={handleStageChange}
                  onLeadClick={id => setSelectedLeadId(id)}
                  onAddLead={id => setCreateStageId(id)}
                  staleDays={staleDays}
                />
              )
            })}
          </div>
          <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
            {activeLead ? <LeadCard lead={activeLead} orgSlug={orgSlug} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* List view — estágios resumidos numa linha expansível */
        <PipelineListView
          stages={stages}
          leads={visibleLeads}
          orgSlug={orgSlug}
          members={members}
          onLeadClick={id => setSelectedLeadId(id)}
          onAddLead={id => setCreateStageId(id)}
          onStageChange={handleStageChange}
          staleDays={staleDays}
        />
      )}
      </div>

      <LostMoveDialog
        open={!!lostMovePrompt}
        onCancel={() => {
          if (lostMovePrompt) {
            setLeads(prev => prev.map(l => (l.id === lostMovePrompt.leadId ? { ...l, stage_id: lostMovePrompt.oldStageId } : l)))
          }
          setLostMovePrompt(null)
        }}
        onConfirm={(dealStatus, reason) => {
          if (lostMovePrompt) {
            commitStageMove(lostMovePrompt.leadId, lostMovePrompt.newStageId, lostMovePrompt.oldStageId, { dealStatus, reason })
          }
          setLostMovePrompt(null)
        }}
      />

      <WonValueDialog
        open={!!wonMovePrompt}
        defaultCents={wonMovePrompt?.defaultCents}
        onCancel={() => {
          if (wonMovePrompt) {
            setLeads(prev => prev.map(l => (l.id === wonMovePrompt.leadId ? { ...l, stage_id: wonMovePrompt.oldStageId } : l)))
          }
          setWonMovePrompt(null)
        }}
        onConfirm={valueCents => {
          if (wonMovePrompt) {
            commitStageMove(wonMovePrompt.leadId, wonMovePrompt.newStageId, wonMovePrompt.oldStageId, undefined, valueCents)
          }
          setWonMovePrompt(null)
        }}
      />

      <NegotiationValueDialog
        open={!!negotiationMovePrompt}
        defaultCents={negotiationMovePrompt?.defaultCents}
        onCancel={() => {
          if (negotiationMovePrompt) {
            setLeads(prev => prev.map(l => (l.id === negotiationMovePrompt.leadId ? { ...l, stage_id: negotiationMovePrompt.oldStageId } : l)))
          }
          setNegotiationMovePrompt(null)
        }}
        onConfirm={valueCents => {
          if (negotiationMovePrompt) {
            commitStageMove(negotiationMovePrompt.leadId, negotiationMovePrompt.newStageId, negotiationMovePrompt.oldStageId, undefined, valueCents)
          }
          setNegotiationMovePrompt(null)
        }}
      />

      <LeadDetailDrawer
        open={!!selectedLeadId}
        onOpenChange={(op: boolean) => !op && setSelectedLeadId(null)}
        leadId={selectedLeadId}
        orgSlug={orgSlug}
        stages={stages}
        members={members}
      />

      {/* New lead dialog */}
      <Dialog
        open={!!createStageId}
        onOpenChange={(op: boolean) => { if (!op) { setCreateStageId(null); setNewLeadSource('manual') } }}
      >
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Lead</DialogTitle></DialogHeader>
          <form onSubmit={async e => {
            e.preventDefault()
            setLoading(true)
            const res = await createLead(orgSlug, new FormData(e.currentTarget))
            setLoading(false)
            if (res.ok) {
              setCreateStageId(null)
              setNewLeadSource('manual')
              toast.success('Lead criado')
            } else {
              toast.error(traduzirErro(res.error))
            }
          }}>
            <input type="hidden" name="stage_id" value={createStageId || ''} />
            <input type="hidden" name="source" value={newLeadSource} />
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input name="name" required autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input name="email" type="email" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input name="phone" placeholder="(11) 99999-9999" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <CurrencyInput name="value_cents" />
                </div>
                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Select value={newLeadSource} onValueChange={setNewLeadSource}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Cadastro manual</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="form">Formulário</SelectItem>
                      <SelectItem value="meta_ads">Meta Ads</SelectItem>
                      <SelectItem value="api">API</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tags (separadas por vírgula)</Label>
                <Input name="tags" placeholder="urgente, indicação" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading}>{loading ? 'Salvando…' : 'Salvar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
