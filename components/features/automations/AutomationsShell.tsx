'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useTransition, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PlayCircle, PauseCircle, Activity, Zap, Plus, Power, Trash2, History, ArrowLeft } from 'lucide-react'
import { createAutomation, toggleAutomation, deleteAutomation } from '@/actions/automations'
import { toast } from 'sonner'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const TRIGGER_LABELS: Record<string, string> = {
  'form.submitted':     'Formulário',
  'lead.stage_changed': 'Estágio',
  'lead.tag_added':     'Tag',
  'task.overdue':       'Tarefa Vencida',
  'lead.stale':         'Sem Contato',
  'appointment.booked': 'Agendamento',
}

export default function AutomationsShell({
  orgSlug,
  automations,
  children,
}: {
  orgSlug: string
  automations: any[]
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router   = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [autoToDelete, setAutoToDelete] = useState<any | null>(null)

  function handleNew() {
    startTransition(async () => {
      try {
        const auto = await createAutomation(orgSlug, {
          name: 'Nova Automação',
          trigger_type: 'form.submitted',
          trigger_config: {},
          steps: [],
        })
        if (auto?.id) router.push(`/app/${orgSlug}/automacoes/${auto.id}`)
        else toast.error('Não foi possível criar a automação')
      } catch (e: any) {
        toast.error(e?.message || 'Erro ao criar automação')
      }
    })
  }

  async function handleToggle(e: React.MouseEvent, auto: any) {
    e.preventDefault(); e.stopPropagation()
    setBusyId(auto.id)
    try {
      const res = await toggleAutomation(orgSlug, auto.id, !auto.is_active)
      if (!res?.ok) toast.error(res?.error || 'Erro ao alternar automação')
      else router.refresh()
    } catch { toast.error('Erro ao alternar automação') }
    finally { setBusyId(null) }
  }

  async function handleDelete(e: React.MouseEvent, auto: any) {
    e.preventDefault(); e.stopPropagation()
    setAutoToDelete(auto)
  }

  async function confirmDelete(auto: any) {
    setBusyId(auto.id)
    try {
      const res = await deleteAutomation(orgSlug, auto.id)
      if (!res?.ok) toast.error(res?.error || 'Erro ao excluir')
      else {
        toast.success('Automação excluída')
        // If we're viewing this automation, go back to list
        if (pathname.includes(auto.id)) router.push(`/app/${orgSlug}/automacoes`)
        else router.refresh()
      }
    } catch { toast.error('Erro ao excluir') }
    finally { setBusyId(null) }
  }



  // On mobile we show ONE pane at a time: the list when on the index route,
  // or the selected automation (detail) otherwise. The back button returns to
  // the list. On md+ both panes are always visible side by side.
  const isDetail = pathname !== `/app/${orgSlug}/automacoes`

  return (
    <div className="-mx-6 -mt-8 -mb-8 flex flex-col" style={{ minHeight: 'calc(100vh - 56px)' }}>

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b bg-background flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {isDetail && (
            <Button asChild variant="ghost" size="icon" className="md:hidden shrink-0 -ml-2">
              <Link href={`/app/${orgSlug}/automacoes`} aria-label="Voltar para a lista">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight leading-tight">Automações</h1>
            <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
              Fluxos automáticos baseados em gatilhos e ações.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/${orgSlug}/automacoes/logs`}>
              <History className="w-4 h-4 mr-1.5" />
              Histórico
            </Link>
          </Button>
          <Button onClick={handleNew} disabled={pending} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            {pending ? 'Criando...' : 'Nova Automação'}
          </Button>
        </div>
      </div>

      {/* ── Split panel ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left sidebar — full width on mobile (hidden while viewing a detail) */}
        <aside className={cn(
          'w-full md:w-72 shrink-0 border-r bg-card flex-col overflow-hidden',
          isDetail ? 'hidden md:flex' : 'flex',
        )}>
          <div className="overflow-y-auto flex-1">
            {automations.length === 0 ? (
              <div className="p-5 text-center">
                <Zap className="w-7 h-7 mx-auto mb-2 opacity-20" />
                <p className="text-xs text-muted-foreground">Nenhuma automação.</p>
                <p className="text-xs text-muted-foreground mt-0.5">Clique em &ldquo;Nova&rdquo;.</p>
              </div>
            ) : (
              <nav className="divide-y divide-border/50">
                {automations.map((auto: any) => {
                  const href     = `/app/${orgSlug}/automacoes/${auto.id}`
                  const isActive = pathname === href || pathname.startsWith(href + '/')
                  const isBusy   = busyId === auto.id

                  return (
                    <Link
                      key={auto.id}
                      href={href}
                      className={cn(
                        'flex flex-col gap-1.5 px-3 py-2.5 transition-colors hover:bg-muted/50 group/item',
                        isActive && 'bg-primary/5 border-l-[3px] border-primary',
                        !isActive && 'border-l-[3px] border-transparent',
                      )}
                    >
                      {/* Name row */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        {auto.is_active
                          ? <PlayCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                          : <PauseCircle className="w-4 h-4 shrink-0 text-muted-foreground/40" />
                        }
                        <span className={cn(
                          'text-sm font-semibold truncate leading-tight flex-1',
                          isActive ? 'text-foreground' : 'text-foreground/80',
                        )}>
                          {auto.name}
                        </span>

                        {/* Action buttons — visible on hover */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0">
                          {/* Toggle on/off */}
                          <button
                            type="button"
                            onClick={e => handleToggle(e, auto)}
                            disabled={isBusy}
                            title={auto.is_active ? 'Desativar' : 'Ativar'}
                            className={cn(
                              'w-6 h-6 rounded flex items-center justify-center transition-colors disabled:opacity-40',
                              auto.is_active
                                ? 'text-emerald-500 hover:bg-emerald-500/10'
                                : 'text-muted-foreground hover:bg-muted',
                            )}
                          >
                            <Power className="w-3 h-3" />
                          </button>
                          {/* Delete */}
                          <button
                            type="button"
                            onClick={e => handleDelete(e, auto)}
                            disabled={isBusy}
                            title="Excluir automação"
                            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-1.5 pl-5">
                        <Badge variant="secondary" className="text-xs py-0 px-1.5 font-normal h-4">
                          {TRIGGER_LABELS[auto.trigger_type] ?? auto.trigger_type}
                        </Badge>
                        {auto.steps?.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {auto.steps.length} passo{auto.steps.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {auto.runsThisMonth > 0 && (
                          <span className="ml-auto flex items-center gap-0.5 text-xs text-muted-foreground/60">
                            <Activity className="w-3 h-3" />
                            {auto.runsThisMonth}
                          </span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </nav>
            )}
          </div>
        </aside>

        {/* Right content — full screen on mobile (hidden on the index route) */}
        <div className={cn(
          'flex-1 min-w-0 overflow-auto bg-muted/20',
          isDetail ? 'block' : 'hidden md:block',
        )}>
          {children}
        </div>

      </div>

      <AlertDialog open={!!autoToDelete} onOpenChange={o => !o && setAutoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir automação?</AlertDialogTitle>
            <AlertDialogDescription>
              {autoToDelete ? `Excluir "${autoToDelete.name}"? ` : ''}Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { confirmDelete(autoToDelete!); setAutoToDelete(null) }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
