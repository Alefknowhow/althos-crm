'use client'

import { useState, useTransition } from 'react'
import {
  deleteSocialAutomation,
  toggleSocialAutomation,
  type SocialAutomation,
  type SocialConnection,
  type SocialInteraction,
} from '@/actions/social-automations'
import { Button } from '@/components/ui/button'
import SocialFunnels from '@/components/features/social/SocialFunnels'
import type { SocialFunnel } from '@/actions/social-funnels'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { MessageSquare, Trash2, Zap, Clock, Users, ChevronRight } from 'lucide-react'
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

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyAutomations() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <p className="text-sm text-muted-foreground max-w-xs">
        Nenhuma regra antiga cadastrada. Novas automações são criadas acima, em &ldquo;Automações do Instagram&rdquo;.
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  orgSlug: string
  initialAutomations: SocialAutomation[]
  initialConnections: SocialConnection[]
  initialInteractions: SocialInteraction[]
  initialFunnels: SocialFunnel[]
}

export function SocialPageClient({
  orgSlug,
  initialAutomations,
  initialConnections,
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
    <div className="h-full overflow-y-auto">
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Instagram · Automações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automatize respostas do Instagram com IA
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: <Zap className="w-4 h-4" />,     label: 'Ativas',                value: activeCount,      color: 'text-emerald-600' },
          { icon: <MessageSquare className="w-4 h-4" />, label: 'Interações hoje', value: todayInteractions, color: 'text-blue-600' },
          { icon: <Users className="w-4 h-4" />,   label: 'Leads capturados',       value: leadsCreated,     color: 'text-violet-600' },
        ].map(s => (
          <div key={s.label} className="rounded-none border border-border bg-card p-4">
            <div className={`flex items-center gap-1.5 text-xs font-medium mb-2 ${s.color}`}>
              {s.icon}
              {s.label}
            </div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Connection status */}
      <div className="rounded-none border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-none flex items-center justify-center text-white text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)' }}
            >
              IG
            </div>
            <div>
              <p className="text-sm font-semibold">Instagram</p>
              {initialConnections.length > 0 ? (
                <p className="text-xs text-emerald-600 font-medium">
                  ● {initialConnections[0].page_name ?? initialConnections[0].username ?? 'Conta conectada'}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Não conectado</p>
              )}
            </div>
          </div>
          {initialConnections.length > 0 ? (
            <Button variant="outline" size="sm" asChild>
              <a href={`/app/${orgSlug}/configuracoes/social`}>
                Gerenciar <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </a>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => { window.location.href = `/api/social/instagram/connect?org=${encodeURIComponent(orgSlug)}` }}
            >
              Conectar Instagram
            </Button>
          )}
        </div>
        {initialConnections.length === 0 && (
          <p className="mt-3 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
            ⚠ Conecte sua conta do Instagram para ativar as automações. Vá em Configurações → Social.
          </p>
        )}
      </div>

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

      {/* Recent interactions */}
      {interactions.length > 0 && (
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
      )}

    </div>
    </div>
  )
}
