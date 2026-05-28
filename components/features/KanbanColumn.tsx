import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import LeadCard from './LeadCard'
import { Button } from '@/components/ui/button'

export default function KanbanColumn({ stage, leads, orgSlug, onLeadClick, onAddLead }: { stage: any, leads: any[], orgSlug: string, onLeadClick: (id: string) => void, onAddLead: (stageId: string) => void }) {
  const { setNodeRef } = useDroppable({ id: stage.id, data: { type: 'Column', stage } })
  const totalValue = leads.reduce((acc, lead) => acc + (lead.value_cents || 0), 0)

  return (
    <div className="flex flex-col bg-muted/30 rounded-xl w-[320px] shrink-0 snap-center border overflow-hidden h-full">
      <div className="p-4 border-b bg-background flex justify-between items-center shrink-0">
        <div>
          <div className="font-semibold text-sm flex items-center gap-2">
            {stage.color && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }}></div>}
            {stage.name} <span className="text-muted-foreground bg-muted px-2 py-0.5 rounded-full text-xs">{leads.length}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">R$ {(totalValue / 100).toFixed(2)}</div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onAddLead(stage.id)}>+</Button>
      </div>
      <div ref={setNodeRef} className="flex-1 p-3 overflow-y-auto space-y-3 min-h-[150px]">
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <LeadCard key={lead.id} lead={lead} orgSlug={orgSlug} onClick={() => onLeadClick(lead.id)} />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
