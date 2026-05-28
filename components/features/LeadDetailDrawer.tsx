'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { getLead } from '@/actions/leads'
import LeadDetailActions from './LeadDetailActions'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Lead = {
  id: string
  name: string
  email?: string
  phone?: string
  value_cents?: number
  tags?: string[]
  pipeline_stages?: { name: string }
}

export default function LeadDetailDrawer({ orgSlug, leadId, open, onOpenChange, stages }: any) {
  const [lead, setLead] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<any[]>([])
  const [automationRuns, setAutomationRuns] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  // limpa estado ao trocar lead
  useEffect(() => {
    if (open) {
      setLead(null)
      setActivities([])
      setAutomationRuns([])
      setError(null)
    }
  }, [open, leadId])

  // fetch com proteção contra race condition
  useEffect(() => {
    let isMounted = true

    if (open && leadId) {
      getLead(orgSlug, leadId)
        .then(({ lead, activities, automation_runs }) => {
          if (!isMounted) return
          setLead(lead)
          setActivities(activities || [])
          setAutomationRuns(automation_runs || [])
        })
        .catch(() => {
          if (!isMounted) return
          setError('Erro ao carregar lead')
        })
    }

    return () => {
      isMounted = false
    }
  }, [open, leadId, orgSlug])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col h-full sm:max-w-md overflow-y-auto">

        {!lead && !error && (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        )}

        {error && (
          <div className="p-8 text-center text-destructive">{error}</div>
        )}

        {lead && (
          <>
            <SheetHeader>
              <SheetTitle>{lead.name}</SheetTitle>
            </SheetHeader>

            <div className="mt-4 space-y-6 flex-1 pb-10">

              <div className="text-sm">
                <div className="text-muted-foreground">{lead.email || 'Sem email'}</div>
                <div className="text-muted-foreground">{lead.phone || 'Sem telefone'}</div>
              </div>

              <LeadDetailActions lead={lead} orgSlug={orgSlug} stages={stages} />

              <div className="space-y-2 text-sm border-t pt-4">
                <div>
                  <span className="text-muted-foreground font-medium">Estágio:</span>{' '}
                  <Badge>{lead.pipeline_stages?.name}</Badge>
                </div>

                <div>
                  <span className="text-muted-foreground font-medium">Valor:</span>{' '}
                  R$ {((lead.value_cents || 0) / 100).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2
                  })}
                </div>

                <div className="flex gap-1 flex-wrap">
                  <span className="text-muted-foreground font-medium">Tags:</span>
                  {lead.tags?.length ? (
                    lead.tags.map((t) => (
                      <Badge key={t} variant="outline">{t}</Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">Nenhuma</span>
                  )}
                </div>
              </div>

              <Tabs defaultValue="timeline" className="w-full border-t pt-4">

                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="automations">Automações</TabsTrigger>
                </TabsList>

                <TabsContent value="timeline" className="mt-4 space-y-4">
                  {activities.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center">
                      Nenhuma atividade ainda.
                    </p>
                  ) : (
                    activities.map((act) => (
                      <div key={act.id} className="text-sm">
                        <div className="font-medium">
                          {act.type === 'manual_created'
                            ? 'Criado manualmente'
                            : act.type === 'stage_changed'
                              ? 'Movido'
                              : act.type === 'note'
                                ? 'Nota'
                                : act.type}
                        </div>

                        {act.type === 'note' && (
                          <div className="text-muted-foreground mt-1 whitespace-pre-wrap bg-muted p-2 rounded">
                            {act.payload.text}
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(act.created_at).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="automations" className="mt-4 space-y-4">
                  {automationRuns.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma automação rodou para este lead.
                    </p>
                  ) : (
                    automationRuns.map((run) => (
                      <div key={run.id} className="text-sm border rounded-lg p-3 bg-card shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">
                            {run.automations?.name || 'Automação Excluída'}
                          </span>

                          <Badge
                            variant={
                              run.status === 'completed'
                                ? 'default'
                                : run.status === 'failed'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                            className={run.status === 'completed' ? 'bg-green-500' : ''}
                          >
                            {run.status.toUpperCase()}
                          </Badge>
                        </div>

                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>Passo atual: {run.current_step}</div>
                          <div>Início: {new Date(run.started_at).toLocaleString('pt-BR')}</div>
                          {run.completed_at && (
                            <div>Fim: {new Date(run.completed_at).toLocaleString('pt-BR')}</div>
                          )}
                          {run.error && (
                            <div className="text-destructive">Erro: {run.error}</div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

              </Tabs>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}