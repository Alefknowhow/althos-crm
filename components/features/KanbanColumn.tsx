import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import LeadCard, { type CardMember } from './LeadCard'
import { Plus } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

export default function KanbanColumn({
  stage,
  leads,
  orgSlug,
  onLeadClick,
  onAddLead,
  membersById,
  members = [],
  stages = [],
  onStageChange,
  staleDays = 7,
}: {
  stage: any
  leads: any[]
  orgSlug: string
  onLeadClick: (id: string) => void
  onAddLead: (stageId: string) => void
  membersById: Record<string, CardMember>
  members?: CardMember[]
  stages?: any[]
  onStageChange?: (leadId: string, stageId: string) => void
  staleDays?: number
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { type: 'Column', stage } })
  const totalValue = leads.reduce((acc, lead) => acc + (lead.value_cents || 0), 0)
  const accent = stage.color || '#6366f1'

  return (
    <div
      className={cn(
        'flex flex-col bg-muted/50 dark:bg-black/20 rounded-lg w-full md:w-[280px] shrink-0 md:snap-center overflow-hidden h-auto md:h-full max-h-[75vh] md:max-h-none transition-colors',
        isOver && 'ring-2 ring-primary/50',
      )}
    >
      {/* Top accent bar — cor da etapa, como no canvas */}
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: accent }} />

      <div className="px-2.5 pt-2.5 pb-1.5 flex justify-between items-center shrink-0">
        <div className="min-w-0">
          <div className="font-bold text-xs flex items-center gap-1.5">
            <span className="truncate">{stage.name}</span>
            <span className="text-muted-foreground/70 text-[11px] font-semibold tabular-nums">
              {leads.length}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onAddLead(stage.id)}
          title="Adicionar lead"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="text-[10.5px] text-muted-foreground/70 px-2.5 pb-2 tabular-nums">
        {formatCurrency(totalValue)}
      </div>

      <div ref={setNodeRef} className="flex-1 px-2 pb-2 overflow-y-auto space-y-2 min-h-[150px]">
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              orgSlug={orgSlug}
              owner={lead.assigned_to ? membersById[lead.assigned_to] : null}
              members={members}
              stages={stages}
              onStageChange={onStageChange ? sid => onStageChange(lead.id, sid) : undefined}
              onClick={() => onLeadClick(lead.id)}
              staleDays={staleDays}
            />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <button
            type="button"
            onClick={() => onAddLead(stage.id)}
            className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border-[1.5px] border-dashed border-border py-8 text-xs text-muted-foreground/60 transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Plus className="h-4 w-4" />
            Adicionar lead
          </button>
        )}
      </div>
    </div>
  )
}
