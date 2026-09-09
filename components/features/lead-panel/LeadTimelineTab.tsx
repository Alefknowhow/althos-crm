'use client'

import { useEffect, useState } from 'react'
import { getLead } from '@/actions/contatos'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import LeadTimeline from './LeadTimeline'
import type { ActivityItem, Stage } from './LeadDataTab'

export default function LeadTimelineTab({ orgSlug, leadId, stages }: { orgSlug: string; leadId: string; stages: Stage[] }) {
  const [activities, setActivities] = useState<ActivityItem[] | null>(null)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setActivities(null)
    setError(false)
    getLead(orgSlug, leadId).then(result => {
      if (!active) return
      if (!result.lead) { setError(true); return }
      setActivities(result.activities)
    }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [orgSlug, leadId, revision])
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeline</h4>
        <Button type="button" variant="ghost" size="sm" onClick={() => setRevision(v => v + 1)}>Atualizar</Button>
      </div>
      {error ? <p role="alert" className="text-xs text-destructive">Não foi possível carregar o histórico. Tente atualizar.</p>
        : activities === null ? <Loader2 aria-label="Carregando histórico" className="h-4 w-4 animate-spin mx-auto" />
        : <LeadTimeline activities={activities} stages={stages} />}
    </div>
  )
}
