'use client'

import { useState, useTransition } from 'react'
import {
  createSocialAutomation,
  deleteSocialAutomation,
  toggleSocialAutomation,
  type SocialAutomation,
  type SocialConnection,
  type SocialInteraction,
} from '@/actions/social-automations'
import { Button } from '@/components/ui/button'
import AutomationsTabsNav from '@/components/features/automations/AutomationsTabsNav'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MessageSquare, Trash2, Plus, Zap, Clock, Users, ChevronRight } from 'lucide-react'
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

function EmptyAutomations({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-5"
        style={{ background: 'linear-gradient(135deg, #E1306C20, #833AB420)', border: '1px solid #E1306C30' }}
      >
        📸
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma automação social ainda</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        Crie regras para responder DMs e comentários do Instagram automaticamente com IA.
      </p>
      <Button onClick={onNew} size="sm">
        <Plus className="w-4 h-4 mr-1" />
        Criar primeira automação
      </Button>
    </div>
  )
}

// ── New Automation Dialog ─────────────────────────────────────────────────────

interface NewDialogProps {
  orgSlug: string
  open: boolean
  onClose: () => void
  onCreated: (auto: SocialAutomation) => void
}

function NewAutomationDialog({ orgSlug, open, onClose, onCreated }: NewDialogProps) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [triggerType, setTriggerType] = useState<SocialAutomation['trigger_type']>('dm_and_comment')
  const [keywords, setKeywords] = useState('')
  const [responseType, setResponseType] = useState<'ai' | 'fixed'>('ai')
  const [fixedResponse, setFixedResponse] = useState('')
  const [aiInstructions, setAiInstructions] = useState('')
  const [createLead, setCreateLead] = useState(true)
  const [sendDmAfterComment, setSendDmAfterComment] = useState(false)

  function reset() {
    setName('')
    setTriggerType('dm_and_comment')
    setKeywords('')
    setResponseType('ai')
    setFixedResponse('')
    setAiInstructions('')
    setCreateLead(true)
    setSendDmAfterComment(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleSubmit() {
    if (!name.trim()) return toast.error('Informe o nome da automação')
    if (responseType === 'fixed' && !fixedResponse.trim())
      return toast.error('Informe a resposta fixa')

    const kws = keywords
      .split(',')
      .map(k => k.trim())
      .filter(Boolean)

    startTransition(async () => {
      try {
        const result = await createSocialAutomation(orgSlug, {
          name: name.trim(),
          trigger_type: triggerType,
          trigger_keywords: kws.length > 0 ? kws : undefined,
          response_type: responseType,
          fixed_response: responseType === 'fixed' ? fixedResponse.trim() : undefined,
          ai_instructions: responseType === 'ai' && aiInstructions.trim() ? aiInstructions.trim() : undefined,
          create_lead: createLead,
          send_dm_after_comment: sendDmAfterComment,
        })
        if (result) onCreated(result as SocialAutomation)
        toast.success('Automação criada!')
        handleClose()
      } catch (err: any) {
        toast.error(err.message ?? 'Erro ao criar automação')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova automação social</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="sa-name">Nome</Label>
            <Input
              id="sa-name"
              placeholder="ex: Responder perguntas de preço"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {/* Trigger type */}
          <div className="space-y-1.5">
            <Label>Disparar quando receber</Label>
            <Select value={triggerType} onValueChange={v => setTriggerType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dm_and_comment">DM + Comentário</SelectItem>
                <SelectItem value="dm">Somente DM</SelectItem>
                <SelectItem value="comment">Somente Comentário</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Keywords filter */}
          <div className="space-y-1.5">
            <Label htmlFor="sa-keywords">
              Palavras-chave <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="sa-keywords"
              placeholder="preço, valor, quanto custa (separadas por vírgula)"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Deixe vazio para responder a todas as mensagens</p>
          </div>

          {/* Response type */}
          <div className="space-y-1.5">
            <Label>Tipo de resposta</Label>
            <Select value={responseType} onValueChange={v => setResponseType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ai">IA (responde como humano)</SelectItem>
                <SelectItem value="fixed">Resposta fixa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {responseType === 'ai' ? (
            <div className="space-y-1.5">
              <Label htmlFor="sa-ai-inst">
                Instruções para a IA <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Textarea
                id="sa-ai-inst"
                rows={3}
                placeholder="ex: Sempre pergunte em qual cidade o cliente está. Mencione que temos suporte 24h."
                value={aiInstructions}
                onChange={e => setAiInstructions(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="sa-fixed">Resposta fixa</Label>
              <Textarea
                id="sa-fixed"
                rows={3}
                placeholder="Oi! Obrigado pelo contato. Vou te mandar as informações no privado 😊"
                value={fixedResponse}
                onChange={e => setFixedResponse(e.target.value)}
              />
            </div>
          )}

          {/* Options */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Criar lead automaticamente</p>
                <p className="text-xs text-muted-foreground">Adiciona o contato ao CRM ao interagir</p>
              </div>
              <Switch checked={createLead} onCheckedChange={setCreateLead} />
            </div>
            {(triggerType === 'comment' || triggerType === 'dm_and_comment') && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Enviar DM após comentário</p>
                  <p className="text-xs text-muted-foreground">Além de responder publicamente, envia um DM</p>
                </div>
                <Switch checked={sendDmAfterComment} onCheckedChange={setSendDmAfterComment} />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={pending}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? 'Criando...' : 'Criar automação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  orgSlug: string
  initialAutomations: SocialAutomation[]
  initialConnections: SocialConnection[]
  initialInteractions: SocialInteraction[]
}

export function SocialPageClient({
  orgSlug,
  initialAutomations,
  initialConnections,
  initialInteractions,
}: Props) {
  const [automations, setAutomations] = useState(initialAutomations)
  const [interactions] = useState(initialInteractions)
  const [showNew, setShowNew] = useState(false)
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
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">

      {/* Abas: CRM / Instagram */}
      <div className="-mb-2 overflow-x-auto"><AutomationsTabsNav orgSlug={orgSlug} /></div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Instagram · DMs & Comentários</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automatize respostas do Instagram com IA
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} size="sm">
          <Plus className="w-4 h-4 mr-1.5" />
          Nova automação
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: <Zap className="w-4 h-4" />,     label: 'Ativas',                value: activeCount,      color: 'text-emerald-600' },
          { icon: <MessageSquare className="w-4 h-4" />, label: 'Interações hoje', value: todayInteractions, color: 'text-blue-600' },
          { icon: <Users className="w-4 h-4" />,   label: 'Leads capturados',       value: leadsCreated,     color: 'text-violet-600' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className={`flex items-center gap-1.5 text-xs font-medium mb-2 ${s.color}`}>
              {s.icon}
              {s.label}
            </div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Connection status */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold"
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
          <Button variant="outline" size="sm" asChild>
            <a href={`/app/${orgSlug}/configuracoes/social`}>
              {initialConnections.length > 0 ? 'Gerenciar' : 'Conectar'} <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </a>
          </Button>
        </div>
        {initialConnections.length === 0 && (
          <p className="mt-3 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
            ⚠ Conecte sua conta do Instagram para ativar as automações. Vá em Configurações → Social.
          </p>
        )}
      </div>

      {/* Automations list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Regras de automação
          </h2>
          <span className="text-xs text-muted-foreground">{automations.length} regra{automations.length !== 1 ? 's' : ''}</span>
        </div>

        {automations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border">
            <EmptyAutomations onNew={() => setShowNew(true)} />
          </div>
        ) : (
          <div className="space-y-2">
            {automations.map(auto => (
              <div
                key={auto.id}
                className={`rounded-xl border border-border bg-card p-4 flex items-center gap-4 transition-opacity ${
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
        )}
      </div>

      {/* Recent interactions */}
      {interactions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Interações recentes
            </h2>
            <span className="text-xs text-muted-foreground">Últimas {interactions.length}</span>
          </div>
          <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
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

      {/* New automation dialog */}
      <NewAutomationDialog
        orgSlug={orgSlug}
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={auto => setAutomations(prev => [auto, ...prev])}
      />
    </div>
  )
}
