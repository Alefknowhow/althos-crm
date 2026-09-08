'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { getLead } from '@/actions/contatos'
import { deleteLead } from '@/actions/contatos'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ExternalLink, Trash2, Save, MoreVertical } from 'lucide-react'
import LeadDataTab, {
  type Member as LeadDataMember, type Stage as LeadDataStage, type ActivityItem, type LeadDataTabHandle,
} from './lead-panel/LeadDataTab'

type Member = { id: string; name: string; email: string }

export default function LeadDetailDrawer({
  orgSlug, leadId, open, onOpenChange, stages, members = [],
}: {
  orgSlug: string
  leadId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  stages: LeadDataStage[]
  members?: Member[]
}) {
  const router = useRouter()
  const [lead, setLead] = useState<any | null>(null)
  const [activities, setActivities] = useState<any[]>([])
  const [automationRuns, setAutomationRuns] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const leadDataRef = useRef<LeadDataTabHandle>(null)

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

  async function handleDelete() {
    if (!lead) return
    setDeleting(true)
    const res = await deleteLead(orgSlug, lead.id)
    setDeleting(false)
    if (!res.ok) {
      const { toast } = await import('sonner')
      toast.error(res.error || 'Erro ao excluir lead')
      return
    }
    setDeleteOpen(false)
    onOpenChange(false)
    router.refresh()
  }

  // LeadDataTab foi construído pro painel do WhatsApp — reaproveitado aqui
  // pra não manter dois formulários de lead em paralelo (o antigo daqui não
  // tinha valor editável, foto, notas, nem os popups de Ganho/Perda/
  // Negociação ao trocar de estágio; o de lá já tinha tudo isso pronto).
  const leadDataMembers: LeadDataMember[] = members.map(m => ({ user_id: m.id, name: m.name, email: m.email }))

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="lg" className="max-h-[85vh] overflow-y-auto w-[96vw] max-w-[96vw] sm:w-auto sm:max-w-2xl">
          {!lead && !error && (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          )}

          {error && (
            <div className="p-8 text-center text-destructive">{error}</div>
          )}

          {lead && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 pr-6">
                  <span className="truncate">{lead.name}</span>
                  {lead.pipeline_stages?.name && <Badge>{lead.pipeline_stages.name}</Badge>}
                </DialogTitle>
              </DialogHeader>

              <div className="flex items-center gap-2 -mt-2">
                <Button size="sm" onClick={() => leadDataRef.current?.save()}>
                  <Save className="w-3.5 h-3.5 mr-1.5" /> Salvar contato
                </Button>
                {/* Desktop: ações secundárias soltas. Mobile: viram itens do ⋯. */}
                <Button variant="outline" size="sm" asChild className="hidden md:inline-flex">
                  <Link href={`/app/${orgSlug}/contatos?sel=${lead.id}`}>
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir na aba de Contatos
                  </Link>
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)} className="hidden md:inline-flex">
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Excluir
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="md:hidden h-8 w-8 shrink-0" aria-label="Mais ações">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/app/${orgSlug}/contatos?sel=${lead.id}`}>
                        <ExternalLink className="w-3.5 h-3.5 mr-2" /> Abrir na aba de Contatos
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteOpen(true)}>
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <LeadDataTab
                ref={leadDataRef}
                orgSlug={orgSlug}
                lead={lead}
                stages={stages}
                members={leadDataMembers}
                hideInlineSaveButton
                enableActions
                onActionAdded={activity => setActivities(prev => [activity, ...prev])}
              />

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
                        <div className="font-medium flex items-center gap-1.5">
                          {act.type === 'manual_created'
                            ? 'Criado manualmente'
                            : act.type === 'stage_changed'
                              ? 'Movido'
                              : act.type === 'note'
                                ? 'Nota'
                                : act.type === 'negotiation_action'
                                  ? 'Ação de negociação'
                                  : act.type}
                          {act.created_by_name && (
                            <span className="text-xs font-normal text-muted-foreground">por {act.created_by_name}</span>
                          )}
                        </div>

                        {act.type === 'note' && (
                          <div className="text-muted-foreground mt-1 whitespace-pre-wrap bg-muted p-2 rounded">
                            {act.payload.text}
                          </div>
                        )}

                        {act.type === 'negotiation_action' && (
                          <div className="text-muted-foreground mt-1 whitespace-pre-wrap bg-muted p-2 rounded">
                            {act.payload.text}
                            {act.payload.next_return_date && (
                              <div className="text-primary font-medium mt-1">
                                Retorno em: {new Date(act.payload.next_return_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                              </div>
                            )}
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
                      <div key={run.id} className="text-sm border rounded-lg p-3 bg-card  ">
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
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tem certeza?</DialogTitle></DialogHeader>
          <div className="py-4 text-sm">Essa ação não pode ser desfeita. O lead e todas suas atividades serão perdidos.</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? 'Excluindo...' : 'Excluir'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
