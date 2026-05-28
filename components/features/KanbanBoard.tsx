'use client'

import React, { useState, useEffect } from 'react'
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
import LeadCard from './LeadCard'
import { moveLeadToStage } from '@/actions/leads'
import LeadDetailDrawer from './LeadDetailDrawer'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createLead } from '@/actions/leads'

export default function KanbanBoard({ orgSlug, initialStages, initialLeads }: { orgSlug: string, initialStages: any[], initialLeads: any[] }) {
  const [stages, setStages] = useState(initialStages)
  const [leads, setLeads] = useState(initialLeads)
  const [activeLead, setActiveLead] = useState<any | null>(null)
  
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  
  const [createStageId, setCreateStageId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setStages(initialStages)
    setLeads(initialLeads)
  }, [initialStages, initialLeads])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragStart(event: any) {
    const { active } = event
    const id = active.id
    const lead = leads.find(l => l.id === id)
    if (lead) setActiveLead(lead)
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
      setLeads((prevLeads) => {
        const activeIndex = prevLeads.findIndex(l => l.id === activeId)
        if (activeIndex === -1) return prevLeads
        const activeLead = prevLeads[activeIndex]
        
        let newStageId = activeLead.stage_id
        if (isOverColumn) {
          newStageId = overId
        } else if (isOverLead) {
          const overIndex = prevLeads.findIndex(l => l.id === overId)
          newStageId = prevLeads[overIndex].stage_id
        }

        if (activeLead.stage_id !== newStageId) {
          return prevLeads.map(l => l.id === activeId ? { ...l, stage_id: newStageId } : l)
        }
        return prevLeads
      })
    }
  }

  async function handleDragEnd(event: any) {
    const { active, over } = event
    setActiveLead(null)
    if (!over) return

    const activeId = active.id
    const lead = leads.find(l => l.id === activeId)
    if (!lead) return

    const oldStageId = initialLeads.find(l => l.id === activeId)?.stage_id
    if (lead.stage_id !== oldStageId && oldStageId) {
      const res = await moveLeadToStage(orgSlug, activeId, lead.stage_id, oldStageId)
      if (!res.ok) {
        setLeads(initialLeads)
        alert('Erro ao mover lead: ' + res.error)
      }
    }
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex h-full gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar">
          {stages.map(stage => {
            const stageLeads = leads.filter(l => l.stage_id === stage.id)
            return (
              <KanbanColumn 
                key={stage.id} 
                stage={stage} 
                leads={stageLeads} 
                orgSlug={orgSlug} 
                onLeadClick={id => setSelectedLeadId(id)}
                onAddLead={(id) => setCreateStageId(id)}
              />
            )
          })}
        </div>
        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }) }}>
          {activeLead ? <LeadCard lead={activeLead} orgSlug={orgSlug} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      <LeadDetailDrawer 
        open={!!selectedLeadId} 
        onOpenChange={(op: boolean) => !op && setSelectedLeadId(null)} 
        leadId={selectedLeadId}
        orgSlug={orgSlug}
        stages={stages}
      />
      
      <Dialog open={!!createStageId} onOpenChange={(op: boolean) => !op && setCreateStageId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Lead</DialogTitle></DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            const res = await createLead(orgSlug, new FormData(e.currentTarget));
            setLoading(false);
            if(res.ok) setCreateStageId(null);
            else alert(res.error);
          }}>
            <input type="hidden" name="stage_id" value={createStageId || ''} />
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input name="name" required />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input name="email" type="email" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input name="phone" />
              </div>
              <div className="space-y-2">
                <Label>Valor (em centavos)</Label>
                <Input name="value_cents" type="number" min="0" />
              </div>
              <div className="space-y-2">
                <Label>Tags (separadas por vírgula)</Label>
                <Input name="tags" placeholder="urgente, quente" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
