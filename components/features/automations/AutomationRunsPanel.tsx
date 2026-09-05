'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Activity } from 'lucide-react'
import AutomationRunCard, { type Run, type Step } from './AutomationRunCard'

type Props = {
  orgSlug: string
  runs: Run[]
  steps: Step[] // automation.steps — to render progress chips
}

export default function AutomationRunsPanel({ orgSlug, runs, steps }: Props) {
  const [filter, setFilter] = useState<'all' | 'running' | 'completed' | 'failed'>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const counts = useMemo(() => {
    let running = 0
    let completed = 0
    let failed = 0
    for (const r of runs) {
      if (r.status === 'running') running++
      else if (r.status === 'completed') completed++
      else if (r.status === 'failed') failed++
    }
    return { all: runs.length, running, completed, failed }
  }, [runs])

  const filtered = useMemo(() => {
    if (filter === 'all') return runs
    return runs.filter(r => r.status === filter)
  }, [runs, filter])

  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground space-y-3">
          <Activity className="w-10 h-10 mx-auto opacity-40" />
          <div>
            <p className="font-medium text-foreground mb-1">Nenhuma execução ainda</p>
            <p className="text-sm max-w-md mx-auto">
              Quando alguém disparar o gatilho desta automação (por exemplo, submeter um formulário),
              uma execução aparece aqui mostrando o progresso passo a passo.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: 'all' as const, label: 'Todas', count: counts.all, color: '' },
          { key: 'running' as const, label: 'Em andamento', count: counts.running, color: 'text-blue-600' },
          { key: 'completed' as const, label: 'Concluídas', count: counts.completed, color: 'text-green-600' },
          { key: 'failed' as const, label: 'Falhadas', count: counts.failed, color: 'text-red-600' },
        ].map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === f.key
                ? 'bg-foreground text-background border-foreground'
                : 'bg-card hover:bg-muted border-border'
            }`}
          >
            {f.label} <span className={filter === f.key ? '' : f.color}>· {f.count}</span>
          </button>
        ))}
      </div>

      {/* Runs */}
      <div className="space-y-2">
        {filtered.map(run => (
          <AutomationRunCard
            key={run.id}
            orgSlug={orgSlug}
            run={run}
            steps={steps}
            isOpen={openId === run.id}
            onToggle={() => setOpenId(openId === run.id ? null : run.id)}
          />
        ))}

        {filtered.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma execução com esse filtro.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
