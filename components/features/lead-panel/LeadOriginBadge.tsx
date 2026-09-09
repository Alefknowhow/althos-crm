import { Badge } from '@/components/ui/badge'
import { leadOriginLabel, type LeadOrigin } from '@/lib/lead-origin'

export default function LeadOriginBadge({ lead }: { lead: LeadOrigin }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Origem do lead</h4>
      <Badge variant="secondary" className="max-w-full whitespace-normal break-words text-xs">
        {leadOriginLabel(lead)}
      </Badge>
    </section>
  )
}
