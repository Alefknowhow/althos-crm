'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Plus, Trash2, MessageSquare, Pencil, Route, Zap, Send, AtSign, Image as ImageIcon,
} from 'lucide-react'
import {
  createFunnel, deleteFunnel, toggleFunnel, type SocialFunnel,
} from '@/actions/social-funnels'
import { TRIGGER_TYPE_LABELS, type FunnelTriggerType } from '@/lib/social/trigger-types'
import { FunnelBuilder } from './SocialFunnelBuilder'

const TYPE_ICONS: Record<FunnelTriggerType, React.ElementType> = {
  dm: Send, comment: MessageSquare, comment_and_dm: MessageSquare, story: ImageIcon, story_reply: AtSign,
}

const TYPE_ORDER: FunnelTriggerType[] = ['dm', 'comment', 'comment_and_dm', 'story', 'story_reply']

export default function SocialFunnels({
  orgSlug, initialFunnels,
}: { orgSlug: string; initialFunnels: SocialFunnel[] }) {
  const [funnels, setFunnels] = useState(initialFunnels)
  const [editing, setEditing] = useState<SocialFunnel | null>(null)
  const [choosingType, setChoosingType] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleCreate(triggerType: FunnelTriggerType) {
    setChoosingType(false)
    startTransition(async () => {
      const res = await createFunnel(orgSlug, triggerType)
      if (!res.ok) { toast.error(res.error); return }
      const fresh: SocialFunnel = {
        id: res.id, organization_id: '', name: 'Nova automação', trigger_type: triggerType,
        trigger_keywords: null, create_lead: true, reply_publicly: false, is_active: true, created_at: new Date().toISOString(),
        steps: [{ sort_order: 0, step_type: 'message', message_text: 'Oi! Que bom te ver por aqui 😊 Como posso te ajudar?', ai_instructions: null, wait_for_reply: true, buttons: [] }],
      }
      setFunnels(f => [fresh, ...f])
      setEditing(fresh)
    })
  }

  function handleToggle(f: SocialFunnel) {
    const next = !f.is_active
    setFunnels(list => list.map(x => x.id === f.id ? { ...x, is_active: next } : x))
    startTransition(async () => {
      const res = await toggleFunnel(orgSlug, f.id, next)
      if (!res.ok) { toast.error(res.error); setFunnels(list => list.map(x => x.id === f.id ? { ...x, is_active: !next } : x)) }
    })
  }

  function handleDelete(f: SocialFunnel) {
    setFunnels(list => list.filter(x => x.id !== f.id))
    startTransition(async () => {
      const res = await deleteFunnel(orgSlug, f.id)
      if (!res.ok) { toast.error(res.error); setFunnels(list => [f, ...list]) }
      else toast.success('Automação removida')
    })
  }

  return (
    <div className="rounded-none border bg-card">
      <div className="flex items-center justify-between gap-3 p-4 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <Zap className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Automações do Instagram</p>
            <p className="text-xs text-muted-foreground">Gatilho → resposta (fixa ou por IA), com botões de resposta rápida ou link.</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setChoosingType(true)} disabled={pending}>
          <Plus className="w-4 h-4 mr-1.5" /> Nova automação
        </Button>
      </div>

      {funnels.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          <Route className="w-7 h-7 mx-auto mb-2 opacity-20" />
          Nenhuma automação ainda. Crie uma pra responder DMs, comentários ou stories automaticamente.
        </div>
      ) : (
        <ul className="divide-y">
          {funnels.map(f => {
            const Icon = TYPE_ICONS[f.trigger_type] || Send
            return (
              <li key={f.id} className="flex items-center gap-3 p-4">
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{f.name}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                      {TRIGGER_TYPE_LABELS[f.trigger_type] || f.trigger_type}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                      {f.steps.length} passo{f.steps.length !== 1 ? 's' : ''}
                    </Badge>
                    {f.trigger_keywords?.length ? (
                      <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                        gatilho: {f.trigger_keywords.join(', ')}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground hidden sm:inline">qualquer mensagem</span>
                    )}
                  </div>
                </div>
                <Switch checked={f.is_active} onCheckedChange={() => handleToggle(f)} />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(f)} title="Editar automação">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(f)} title="Excluir automação">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Passo 1 do wizard: escolher o tipo ANTES do gatilho */}
      <Dialog open={choosingType} onOpenChange={setChoosingType}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Que tipo de automação você quer criar?</DialogTitle>
            <DialogDescription>Isso define em que canal do Instagram ela vai responder.</DialogDescription>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-2">
            {TYPE_ORDER.map(type => {
              const Icon = TYPE_ICONS[type]
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleCreate(type)}
                  className="flex items-center gap-2.5 rounded-lg border p-3 text-left text-sm hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <Icon className="w-4 h-4 text-primary shrink-0" />
                  {TRIGGER_TYPE_LABELS[type]}
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {editing && (
        <FunnelBuilder
          orgSlug={orgSlug}
          funnel={editing}
          onClose={() => setEditing(null)}
          onSaved={updated => {
            setFunnels(list => list.map(x => x.id === updated.id ? updated : x))
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
