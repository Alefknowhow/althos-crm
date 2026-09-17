'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Search, Zap, Copy, Trash2, Activity } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toggleAutomation, deleteAutomation, duplicateAutomation } from '@/actions/automations'
import { triggerMeta } from '@/lib/automations/trigger-meta'

export type AutomationListItem = {
  id: string
  name: string
  is_active: boolean
  trigger_type: string
  steps: { type: string }[]
  runsThisMonth: number
}

type Channel = 'all' | 'whatsapp' | 'instagram' | 'other'

/** Canal de origem só pra agrupar visualmente na lista — deriva do
 *  trigger_type (Instagram tem prefixo próprio) ou do primeiro passo que
 *  manda mensagem, quando o gatilho é genérico (ex.: "Formulário
 *  Submetido" → primeiro passo "Enviar WhatsApp"). */
function channelOf(auto: AutomationListItem): Exclude<Channel, 'all'> {
  if (auto.trigger_type.startsWith('instagram.')) return 'instagram'
  if (auto.steps.some(s => s.type === 'send_instagram_dm')) return 'instagram'
  if (auto.steps.some(s => s.type === 'send_whatsapp')) return 'whatsapp'
  return 'other'
}

const CHANNEL_LABEL: Record<Exclude<Channel, 'all'>, string> = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', other: 'Pipeline',
}

export default function AutomationsListGrid({ orgSlug, automations }: { orgSlug: string; automations: AutomationListItem[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [channel, setChannel] = useState<Channel>('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return automations.filter(a => {
      if (channel !== 'all' && channelOf(a) !== channel) return false
      if (q && !a.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [automations, query, channel])

  async function handleToggle(auto: AutomationListItem) {
    setBusyId(auto.id)
    const res = await toggleAutomation(orgSlug, auto.id, !auto.is_active)
    setBusyId(null)
    if (!res?.ok) { toast.error(res?.error || 'Erro ao alternar automação'); return }
    router.refresh()
  }

  async function handleDuplicate(autoId: string) {
    setBusyId(autoId)
    const res = await duplicateAutomation(orgSlug, autoId)
    setBusyId(null)
    if (!res.ok || !res.automation) { toast.error(res.ok ? 'Erro ao duplicar' : res.error); return }
    toast.success('Automação duplicada')
    router.push(`/app/${orgSlug}/automacoes/${res.automation.id}`)
  }

  async function handleDelete() {
    if (!deleteId) return
    setBusyId(deleteId)
    const res = await deleteAutomation(orgSlug, deleteId)
    setBusyId(null)
    setDeleteId(null)
    if (!res?.ok) { toast.error(res?.error || 'Erro ao excluir'); return }
    toast.success('Automação excluída')
    router.refresh()
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-lg font-semibold mr-auto">Automações · {automations.length}</h1>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar automação..."
            className="h-9 w-full rounded-full border border-input bg-muted/50 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Select value={channel} onValueChange={v => setChannel(v as Channel)}>
          <SelectTrigger className="h-9 w-[150px] text-xs shrink-0">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Canal: Todos</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="other">Pipeline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg bg-card p-12 text-center text-muted-foreground">
          {automations.length === 0 ? 'Nenhuma automação ainda. Crie a primeira com o botão "Nova Automação".' : 'Nenhuma automação encontrada com esses filtros.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map(auto => {
            const meta = triggerMeta(auto.trigger_type)
            const Icon = meta.icon
            const ch = channelOf(auto)
            return (
              <div key={auto.id} className="rounded-xl border bg-card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-9 h-9 rounded-lg shrink-0 grid place-items-center" style={{ backgroundColor: `${meta.color}20`, color: meta.color }}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <Link href={`/app/${orgSlug}/automacoes/${auto.id}`} className="text-sm font-semibold hover:underline truncate block">
                        {auto.name}
                      </Link>
                      <p className="text-xs text-muted-foreground truncate">{CHANNEL_LABEL[ch]}</p>
                    </div>
                  </div>
                  <Switch checked={auto.is_active} onCheckedChange={() => handleToggle(auto)} disabled={busyId === auto.id} className="shrink-0" />
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground rounded-lg bg-muted/40 px-2.5 py-1.5">
                  <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: meta.color }} fill={meta.color} strokeWidth={0} />
                  <span className="truncate">Gatilho: {meta.label}</span>
                </div>

                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-sm font-bold tabular-nums">{auto.steps.length}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground ml-1">passo{auto.steps.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Activity className="w-3 h-3 text-muted-foreground" />
                    <span className="text-sm font-bold tabular-nums">{auto.runsThisMonth}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">execuções (30d)</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-auto">
                  <Button asChild size="sm" className="flex-1 h-8 text-xs">
                    <Link href={`/app/${orgSlug}/automacoes/${auto.id}`}>Abrir canvas</Link>
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" title="Duplicar" disabled={busyId === auto.id} onClick={() => handleDuplicate(auto.id)}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" title="Excluir" disabled={busyId === auto.id} onClick={() => setDeleteId(auto.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir automação?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
