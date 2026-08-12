import { Badge } from '@/components/ui/badge'
import type { ObjectiveGroup } from '@/lib/marketing/objective'
import { OBJECTIVE_GROUP_LABELS } from '@/lib/marketing/objective'

const OBJECTIVE_GROUP_CLASSES: Record<ObjectiveGroup, string> = {
  leads: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400',
  messaging: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400',
  traffic: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400',
  sales: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
  awareness: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400',
  other: 'bg-muted text-muted-foreground border-border',
}

export default function ObjectiveBadge({ group }: { group: ObjectiveGroup }) {
  return (
    <Badge variant="outline" className={`text-xs ${OBJECTIVE_GROUP_CLASSES[group]}`}>
      {OBJECTIVE_GROUP_LABELS[group]}
    </Badge>
  )
}
