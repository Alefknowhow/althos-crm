import { Badge } from '@/components/ui/badge'
import type { ObjectiveGroup } from '@/lib/marketing/objective'
import { OBJECTIVE_GROUP_LABELS } from '@/lib/marketing/objective'

const OBJECTIVE_GROUP_CLASSES: Record<ObjectiveGroup, string> = {
  leads: 'bg-[color:var(--chart-1)] text-white',
  messaging: 'bg-[color:var(--chart-2)] text-white',
  traffic: 'bg-[color:var(--chart-3)] text-white',
  sales: 'bg-[color:var(--chart-4)] text-white',
  awareness: 'bg-[color:var(--chart-5)] text-white',
  other: 'bg-muted-foreground/60 text-white',
}

export default function ObjectiveBadge({ group }: { group: ObjectiveGroup }) {
  return (
    <Badge className={`text-xs ${OBJECTIVE_GROUP_CLASSES[group]}`}>
      {OBJECTIVE_GROUP_LABELS[group]}
    </Badge>
  )
}
