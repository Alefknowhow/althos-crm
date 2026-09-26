'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Search, Zap, Copy, Trash2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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

/** Uma linha da tabela de automações — mesmo conteúdo do card antigo
 *  (ícone/nome/canal/gatilho/passos/execuções/status/ações), só reorganizado
 *  em colunas compactas em vez de um card grande em grade. */
function AutomationListRow({
  auto, orgSlug, busy, onToggle, onDuplicate, onDelete, selected, onSelectChange,
}: {
  auto: AutomationListItem
  orgSlug: string
  busy: boolean
  onToggle: () => void
  onDuplicate: () => void
  onDelete: () => void
  selected: boolean
  onSelectChange: (checked: boolean) => void
}) {
  const meta = triggerMeta(auto.trigger_type)
  const Icon = meta.icon
  const ch = channelOf(auto)

  return (
    <tr className={cnRow(auto.is_active)}>
      <td className="w-10 px-3 py-2.5">
        <Checkbox checked={selected} onCheckedChange={v => onSelectChange(!!v)} aria-label={`Selecionar ${auto.name}`} />
      </td>
      <td className="px-3 py-2.5 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg shrink-0 grid place-items-center" style={{ backgroundColor: `${meta.color}20`, color: meta.color }}>
            <Icon className="w-4 h-4" />
          </span>
          <Link href={`/app/${orgSlug}/automacoes/${auto.id}`} className="text-sm font-medium hover:underline truncate">
            {auto.name}
          </Link>
        </div>
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{CHANNEL_LABEL[ch]}</td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[220px]">
        <span className="inline-flex items-center gap-1.5 truncate">
          <Zap className="w-3 h-3 shrink-0" style={{ color: meta.color }} fill={meta.color} strokeWidth={0} />
          <span className="truncate">{meta.label}</span>
        </span>
      </td>
      <td className="px-3 py-2.5 text-sm tabular-nums text-center">{auto.steps.length}</td>
      <td className="px-3 py-2.5 text-sm tabular-nums text-center">{auto.runsThisMonth}</td>
      <td className="px-3 py-2.5">
        <Switch checked={auto.is_active} onCheckedChange={onToggle} disabled={busy} />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-1.5">
          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
            <Link href={`/app/${orgSlug}/automacoes/${auto.id}`}>Abrir canvas</Link>
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Duplicar" disabled={busy} onClick={onDuplicate}>
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" title="Excluir" disabled={busy} onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}

function cnRow(active: boolean) {
  return `border-b last:border-b-0 hover:bg-muted/30 transition-colors ${active ? '' : 'text-muted-foreground/80 bg-muted/10'}`
}

export default function AutomationsListGrid({ orgSlug, automations }: { orgSlug: string; automations: AutomationListItem[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [channel, setChannel] = useState<Channel>('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return automations.filter(a => {
      if (channel !== 'all' && channelOf(a) !== channel) return false
      if (q && !a.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [automations, query, channel])

  const allVisibleSelected = visible.length > 0 && visible.every(a => selectedIds.has(a.id))

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      for (const a of visible) checked ? next.add(a.id) : next.delete(a.id)
      return next
    })
  }

  function toggleSelectOne(id: string, checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }

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
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          {automations.length === 0 ? 'Nenhuma automação ainda. Crie a primeira com o botão "Nova Automação".' : 'Nenhuma automação encontrada com esses filtros.'}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[860px]">
            <thead>
              <tr className="border-b bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="w-10 px-3 py-2 font-medium">
                  <Checkbox checked={allVisibleSelected} onCheckedChange={v => toggleSelectAll(!!v)} aria-label="Selecionar todas" />
                </th>
                <th className="px-3 py-2 font-medium">Automação</th>
                <th className="px-3 py-2 font-medium">Canal</th>
                <th className="px-3 py-2 font-medium">Gatilho</th>
                <th className="px-3 py-2 font-medium text-center">Passos</th>
                <th className="px-3 py-2 font-medium text-center">Execuções (30D)</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(auto => (
                <AutomationListRow
                  key={auto.id}
                  auto={auto}
                  orgSlug={orgSlug}
                  busy={busyId === auto.id}
                  onToggle={() => handleToggle(auto)}
                  onDuplicate={() => handleDuplicate(auto.id)}
                  onDelete={() => setDeleteId(auto.id)}
                  selected={selectedIds.has(auto.id)}
                  onSelectChange={checked => toggleSelectOne(auto.id, checked)}
                />
              ))}
            </tbody>
          </table>
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
