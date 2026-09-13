'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  deleteSocialAutomation,
  toggleSocialAutomation,
  type SocialAutomation,
  type SocialInteraction,
} from '@/actions/social-automations'
import { Button } from '@/components/ui/button'
import SocialFunnels from '@/components/features/social/SocialFunnels'
import type { SocialFunnel } from '@/actions/social-funnels'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MessageSquare, Trash2, Zap, Clock, Users, MessageCircle, Reply } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer } from 'recharts'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

// ── Helpers ───────────────────────────────────────────────────────────────────

function triggerLabel(t: SocialAutomation['trigger_type']) {
  return t === 'dm' ? 'DM' : t === 'comment' ? 'Comentário' : 'DM + Comentário'
}

function triggerColor(t: SocialAutomation['trigger_type']) {
  return t === 'dm'
    ? 'bg-blue-100 text-blue-700'
    : t === 'comment'
    ? 'bg-amber-100 text-amber-700'
    : 'bg-violet-100 text-violet-700'
}

function responseColor(r: SocialAutomation['response_type']) {
  return r === 'ai' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
}

/** Últimos 7 dias, contagem de interações por dia (mais antigo → mais recente) — alimenta o mini-gráfico do card "Total de interações". */
function buildDailySeries(interactions: SocialInteraction[]): { day: string; count: number }[] {
  const days: { key: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    days.push({ key: d.toISOString().slice(0, 10), count: 0 })
  }
  const byDay = new Map(days.map(d => [d.key, d]))
  for (const inter of interactions) {
    const key = inter.created_at.slice(0, 10)
    const bucket = byDay.get(key)
    if (bucket) bucket.count++
  }
  return days.map(d => ({ day: d.key, count: d.count }))
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  orgSlug: string
  initialAutomations: SocialAutomation[]
  initialInteractions: SocialInteraction[]
  initialFunnels: SocialFunnel[]
}

export function SocialPageClient({
  orgSlug,
  initialAutomations,
  initialInteractions,
  initialFunnels,
}: Props) {
  const [automations, setAutomations] = useState(initialAutomations)
  const [interactions] = useState(initialInteractions)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const activeCount = automations.filter(a => a.is_active).length
  const todayInteractions = interactions.filter(
    i => new Date(i.created_at) > new Date(Date.now() - 86_400_000),
  ).length
  const leadsCreated = interactions.filter(i => i.lead_created).length
  const dmsResponded = interactions.filter(i => i.interaction_type === 'dm' && i.response_text).length
  const commentsCount = interactions.filter(i => i.interaction_type === 'comment').length
  const dailySeries = useMemo(() => buildDailySeries(interactions), [interactions])

  function handleToggle(id: string, current: boolean) {
    setTogglingId(id)
    startTransition(async () => {
      try {
        await toggleSocialAutomation(orgSlug, id, !current)
        setAutomations(prev =>
          prev.map(a => (a.id === id ? { ...a, is_active: !current } : a)),
        )
      } catch (err: any) {
        toast.error(err.message)
      } finally {
        setTogglingId(null)
      }
    })
  }

  function handleDelete(id: string) {
    setDeletingId(id)
    startTransition(async () => {
      try {
        await deleteSocialAutomation(orgSlug, id)
        setAutomations(prev => prev.filter(a => a.id !== id))
        toast.success('Automação removida')
      } catch (err: any) {
        toast.error(err.message)
      } finally {
        setDeletingId(null)
      }
    })
  }

  return (
    <div className="h-full flex flex-col">

      {/* ── Painel de métricas — fixo, não rola com a página ──────────────── */}
      <div className="shrink-0 p-6 pb-0 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { icon: <Zap className="w-4 h-4" />,           label: 'Ativas',            value: activeCount,       color: 'text-emerald-600' },
            { icon: <MessageSquare className="w-4 h-4" />, label: 'Interações hoje',   value: todayInteractions, color: 'text-blue-600' },
            { icon: <Users className="w-4 h-4" />,         label: 'Leads capturados',  value: leadsCreated,      color: 'text-violet-600' },
            { icon: <Reply className="w-4 h-4" />,         label: 'DMs respondidas',   value: dmsResponded,      color: 'text-sky-600' },
            { icon: <MessageCircle className="w-4 h-4" />, label: 'Comentários',       value: commentsCount,     color: 'text-amber-600' },
          ].map(s => (
            <div key={s.label} className="rounded-none border border-border bg-card p-4">
              <div className={`flex items-center gap-1.5 text-xs font-medium mb-2 ${s.color}`}>
                {s.icon}
                {s.label}
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </div>
          ))}

          {/* Total de interações — com mini-gráfico dos últimos 7 dias */}
          <div className="rounded-none border border-border bg-card p-4 flex flex-col">
            <div className="flex items-center gap-1.5 text-xs font-medium mb-2 text-rose-600">
              <MessageSquare className="w-4 h-4" />
              Total de interações
            </div>
            <div className="flex items-end justify-between gap-2 flex-1">
              <p className="text-2xl font-bold text-foreground">{interactions.length}</p>
              <div className="w-20 h-8 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailySeries}>
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="currentColor"
                      className="text-rose-500"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Conteúdo — abas, só esta área rola ────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6 max-w-6xl mx-auto w-full">
        <Tabs defaultValue="automacoes">
          <TabsList>
            <TabsTrigger value="automacoes">Automações</TabsTrigger>
            <TabsTrigger value="interacoes">Interações recentes</TabsTrigger>
          </TabsList>

          <TabsContent value="automacoes" className="space-y-6 mt-4">
            {/* Funis de conversa em DM */}
            <SocialFunnels orgSlug={orgSlug} initialFunnels={initialFunnels} />

            {/* Regras antigas (legado) — só aparece se existir alguma */}
            {automations.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Regras antigas (legado)
                </h2>
                <span className="text-xs text-muted-foreground">{automations.length} regra{automations.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="space-y-2">
                  {automations.map(auto => (
                    <div
                      key={auto.id}
                      className={`rounded-none border border-border bg-card p-4 flex items-center gap-4 transition-opacity ${
                        !auto.is_active ? 'opacity-60' : ''
                      }`}
                    >
                      {/* Toggle */}
                      <Switch
                        checked={auto.is_active}
                        onCheckedChange={() => handleToggle(auto.id, auto.is_active)}
                        disabled={togglingId === auto.id}
                      />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-semibold text-foreground truncate">{auto.name}</p>
                          <Badge variant="outline" className={`text-[10px] font-semibold ${triggerColor(auto.trigger_type)}`}>
                            {triggerLabel(auto.trigger_type)}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] font-semibold ${responseColor(auto.response_type)}`}>
                            {auto.response_type === 'ai' ? '✦ IA' : 'Fixa'}
                          </Badge>
                          {auto.create_lead && (
                            <Badge variant="outline" className="text-[10px] font-semibold bg-blue-50 text-blue-700">
                              + Lead
                            </Badge>
                          )}
                        </div>
                        {auto.trigger_keywords && auto.trigger_keywords.length > 0 && (
                          <p className="text-xs text-muted-foreground truncate">
                            Palavras: {auto.trigger_keywords.join(', ')}
                          </p>
                        )}
                        {!auto.trigger_keywords || auto.trigger_keywords.length === 0 && (
                          <p className="text-xs text-muted-foreground">Responde a todas as mensagens</p>
                        )}
                      </div>

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => handleDelete(auto.id)}
                        disabled={deletingId === auto.id}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
            )}
          </TabsContent>

          <TabsContent value="interacoes" className="mt-4">
            {interactions.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Interações recentes
                  </h2>
                  <span className="text-xs text-muted-foreground">Últimas {interactions.length}</span>
                </div>
                <div className="rounded-none border border-border overflow-hidden divide-y divide-border">
                  {interactions.map(inter => (
                    <div key={inter.id} className="flex items-start gap-3 p-3 bg-card hover:bg-muted/30 transition-colors">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5 ${
                          inter.interaction_type === 'dm'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {inter.interaction_type === 'dm' ? 'DM' : '💬'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-foreground">
                            {inter.sender_name ?? inter.sender_username ?? 'Usuário'}
                          </span>
                          {inter.sender_username && (
                            <span className="text-xs text-muted-foreground">@{inter.sender_username}</span>
                          )}
                          {inter.lead_created && (
                            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 rounded-full px-1.5 py-0.5">
                              Lead criado
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{inter.inbound_text}</p>
                        {inter.response_text && (
                          <p className="text-xs text-foreground/60 mt-0.5 line-clamp-1">
                            ↳ {inter.response_text}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 mt-0.5">
                        {inter.response_type === 'ai' && (
                          <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 rounded-full px-1.5 py-0.5">IA</span>
                        )}
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {formatDistanceToNow(new Date(inter.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Nenhuma interação ainda.</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
