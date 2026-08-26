'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Search, Plus, TrendingUp, TrendingDown, Megaphone, ImagePlus, Loader2, MoreVertical, Archive, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, formatCurrency } from '@/lib/utils'
import { HEALTH_LABEL, HEALTH_DOT_CLASS, HEALTH_BADGE_CLASS } from '@/lib/trafego/health-status'
import type { HealthStatus } from '@/lib/trafego/health-status'
import { createCustomer, setContatoStatus, deleteLead } from '@/actions/contatos'

export type ClientCardData = {
  id: string
  name: string
  niche: string | null
  platform: string | null
  health: HealthStatus
  investmentCents: number
  prevInvestmentCents: number
  leads: number
  prevLeads: number
  cplCents: number | null
  roas: number | null
  activeCampaigns: number
  pendingCreatives: number
  lastSyncDaysAgo: number | null
}

const PLATFORM_LABEL: Record<string, string> = { meta: 'Meta Ads', google: 'Google Ads', tiktok: 'TikTok Ads', other: 'Outra plataforma' }

const FILTERS: { key: 'all' | HealthStatus; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'saudavel', label: 'Ativos' },
  { key: 'atencao', label: 'Atenção' },
  { key: 'critico', label: 'Críticos' },
  { key: 'sem_dados', label: 'Sem dados' },
]

function syncLabel(daysAgo: number | null): string {
  if (daysAgo === null) return 'Nunca sincronizado'
  if (daysAgo === 0) return 'Sincronizado hoje'
  if (daysAgo === 1) return 'Sincronizado há 1 dia'
  return `Sincronizado há ${daysAgo} dias`
}

export default function TrafegoCommandCenter({ orgSlug, clients }: { orgSlug: string; clients: ClientCardData[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | HealthStatus>('all')
  const [newClientOpen, setNewClientOpen] = useState(false)
  const [newClientForm, setNewClientForm] = useState({ name: '', email: '', phone: '' })
  const [creating, startCreating] = useTransition()
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [, startMutating] = useTransition()

  function handleInactivate(id: string, name: string) {
    if (!confirm(`Inativar "${name}"? Ele sai da lista de clientes de tráfego, mas os dados continuam guardados — dá pra reativar em Contatos.`)) return
    setHiddenIds(prev => new Set(prev).add(id))
    startMutating(async () => {
      const res = await setContatoStatus(orgSlug, id, 'inativo')
      if (!(res as any).ok) {
        toast.error((res as any).error || 'Erro ao inativar cliente')
        setHiddenIds(prev => { const next = new Set(prev); next.delete(id); return next })
        return
      }
      toast.success('Cliente inativado')
    })
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir "${name}"? Essa ação não pode ser desfeita — o contato e todo o histórico dele (campanhas, criativos, links de rastreamento) serão perdidos.`)) return
    setHiddenIds(prev => new Set(prev).add(id))
    startMutating(async () => {
      const res = await deleteLead(orgSlug, id)
      if (!(res as any).ok) {
        toast.error((res as any).error || 'Erro ao excluir cliente')
        setHiddenIds(prev => { const next = new Set(prev); next.delete(id); return next })
        return
      }
      toast.success('Cliente excluído')
    })
  }

  function handleCreateClient() {
    if (!newClientForm.name.trim()) { toast.error('Informe o nome do cliente.'); return }
    startCreating(async () => {
      const res = await createCustomer(orgSlug, newClientForm)
      if (!res.ok) { toast.error((res as any).error || 'Erro ao criar cliente'); return }
      toast.success('Cliente criado — configure a estratégia dele agora.')
      setNewClientOpen(false)
      setNewClientForm({ name: '', email: '', phone: '' })
      router.push(`/app/${orgSlug}/agencias-trafego/trafego/${res.id}`)
    })
  }

  const summary = useMemo(() => {
    const out: Record<HealthStatus, number> = { saudavel: 0, atencao: 0, critico: 0, sem_dados: 0 }
    for (const c of clients) out[c.health]++
    return out
  }, [clients])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return clients.filter(c => {
      if (hiddenIds.has(c.id)) return false
      if (filter !== 'all' && c.health !== filter) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q) || (c.niche || '').toLowerCase().includes(q)
    })
  }, [clients, query, filter, hiddenIds])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tráfego</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestão e acompanhamento das campanhas dos seus clientes.</p>
        </div>
        <Button size="sm" onClick={() => setNewClientOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Cliente
        </Button>
      </div>

      <Dialog open={newClientOpen} onOpenChange={setNewClientOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo cliente de gestão</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input
                value={newClientForm.name}
                onChange={e => setNewClientForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nome do cliente"
                onKeyDown={e => { if (e.key === 'Enter') handleCreateClient() }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">E-mail</Label>
              <Input
                type="email"
                value={newClientForm.email}
                onChange={e => setNewClientForm(f => ({ ...f, email: e.target.value }))}
                placeholder="cliente@email.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone</Label>
              <Input
                value={newClientForm.phone}
                onChange={e => setNewClientForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="(00) 00000-0000"
              />
            </div>
            <Button className="w-full" onClick={handleCreateClient} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
              Criar e configurar estratégia
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resumo */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{clients.length} cliente{clients.length !== 1 ? 's' : ''} ativo{clients.length !== 1 ? 's' : ''}</span>
        {(['saudavel', 'atencao', 'critico', 'sem_dados'] as HealthStatus[]).map(h => summary[h] > 0 && (
          <span key={h} className="inline-flex items-center gap-1.5">
            <span className={cn('w-1.5 h-1.5 rounded-full', HEALTH_DOT_CLASS[h])} />
            {summary[h]} {HEALTH_LABEL[h].toLowerCase()}
          </span>
        ))}
      </div>

      {/* Busca + filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Pesquisar cliente, campanha ou conta…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'px-2.5 py-1.5 text-xs rounded-sm font-medium transition-colors whitespace-nowrap',
                filter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Nenhum cliente encontrado.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => {
            const trend = c.prevInvestmentCents > 0 ? ((c.investmentCents - c.prevInvestmentCents) / c.prevInvestmentCents) * 100 : null
            return (
              <div
                key={c.id}
                role="link"
                tabIndex={0}
                onClick={() => router.push(`/app/${orgSlug}/agencias-trafego/trafego/${c.id}`)}
                onKeyDown={e => { if (e.key === 'Enter') router.push(`/app/${orgSlug}/agencias-trafego/trafego/${c.id}`) }}
                className="block bg-card border rounded-lg p-4 hover:border-primary/50 transition-colors space-y-3 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    {c.niche && <div className="text-xs text-muted-foreground truncate">{c.niche}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="outline" className={cn('gap-1', HEALTH_BADGE_CLASS[c.health])}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', HEALTH_DOT_CLASS[c.health])} />
                      {HEALTH_LABEL[c.health]}
                    </Badge>
                    <div onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="h-6 w-6 grid place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                            aria-label="Mais opções"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleInactivate(c.id, c.name)}>
                            <Archive className="w-3.5 h-3.5 mr-2" /> Inativar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(c.id, c.name)} className="text-destructive focus:text-destructive">
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>

                {c.platform && (
                  <div className="text-xs text-muted-foreground">{PLATFORM_LABEL[c.platform] || c.platform}</div>
                )}

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Invest. (30d)</div>
                    <div className="font-semibold tabular-nums">{formatCurrency(c.investmentCents)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Leads</div>
                    <div className="font-semibold tabular-nums">{c.leads}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">CPL</div>
                    <div className="font-semibold tabular-nums">{c.cplCents != null ? formatCurrency(c.cplCents) : '—'}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                  <span className="inline-flex items-center gap-1">
                    <Megaphone className="w-3 h-3" /> {c.activeCampaigns} campanha{c.activeCampaigns !== 1 ? 's' : ''}
                  </span>
                  {c.roas != null && <span>ROAS {c.roas.toFixed(1)}x</span>}
                  {trend !== null && (
                    <span className={cn('inline-flex items-center gap-0.5', trend >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(trend).toFixed(0)}%
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{syncLabel(c.lastSyncDaysAgo)}</span>
                  {c.pendingCreatives > 0 && (
                    <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                      <ImagePlus className="w-3 h-3" /> {c.pendingCreatives} pendente{c.pendingCreatives !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
