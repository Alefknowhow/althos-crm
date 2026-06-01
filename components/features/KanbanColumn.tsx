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
}: {
  stage: any
  leads: any[]
  orgSlug: string
  onLeadClick: (id: string) => void
  onAddLead: (stageId: string) => void
  membersById: Record<string, CardMember>
  members?: CardMember[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { type: 'Column', stage } })
  const totalValue = leads.reduce((acc, lead) => acc + (lead.value_cents || 0), 0)
  const accent = stage.color || '#6366f1'

  return (
    <div
      className={cn(
        'flex flex-col bg-muted/30 rounded-xl w-full md:w-[320px] shrink-0 md:snap-center border overflow-hidden h-auto md:h-full max-h-[75vh] md:max-h-none transition-colors',
        isOver && 'ring-2 ring-brand-400 border-brand-300',
      )}
    >
      {/* Top accent bar */}
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: accent }} />

      <div className="px-4 py-3 border-b bg-background flex justify-between items-center shrink-0">
        <div className="min-w-0">
          <div className="font-semibold text-sm flex items-center gap-2">
            <span className="truncate">{stage.name}</span>
            <span className="text-muted-foreground bg-muted px-2 py-0.5 rounded-full text-xs tabular-nums">
              {leads.length}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
            {formatCurrency(totalValue)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onAddLead(stage.id)}
          title="Adicionar lead"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div ref={setNodeRef} className="flex-1 p-3 overflow-y-auto space-y-2.5 min-h-[150px]">
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              orgSlug={orgSlug}
              owner={lead.assigned_to ? membersById[lead.assigned_to] : null}
              members={members}
              onClick={() => onLeadClick(lead.id)}
            />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <button
            type="button"
            onClick={() => onAddLead(stage.id)}
            className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border py-8 text-xs text-muted-foreground/70 transition-colors hover:border-brand-300 hover:text-brand-600"
          >
            <Plus className="h-4 w-4" />
            Adicionar lead
          </button>
        )}
      </div>
    </div>
  )
}
