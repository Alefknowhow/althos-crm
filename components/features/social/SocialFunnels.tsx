'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Plus, Trash2, ChevronUp, ChevronDown, MessageSquare, Sparkles, Pencil,
  Route, Loader2, Zap, Send, AtSign, Image as ImageIcon, Link2, MousePointerClick,
} from 'lucide-react'
import {
  createFunnel, updateFunnel, deleteFunnel, toggleFunnel, saveFunnelSteps,
  type SocialFunnel, type FunnelStep, type FunnelButton,
} from '@/actions/social-funnels'
import { TRIGGER_TYPE_LABELS, type FunnelTriggerType } from '@/lib/social/trigger-types'

type EditStep = FunnelStep & { _key: string }
let seq = 0
const nk = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`

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
        trigger_keywords: null, create_lead: true, is_active: true, created_at: new Date().toISOString(),
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

/* ═══════════════ Editor de botões de um passo (resposta rápida / link) ═══════════════ */
function ButtonsEditor({ buttons, onChange }: { buttons: FunnelButton[]; onChange: (b: FunnelButton[]) => void }) {
  function update(i: number, patch: Partial<FunnelButton>) {
    onChange(buttons.map((b, j) => j === i ? { ...b, ...patch } : b))
  }
  function add(type: 'reply' | 'link') {
    if (buttons.length >= 3) return
    onChange([...buttons, { type, label: type === 'link' ? 'Ver mais' : 'Sim', value: '' }])
  }
  return (
    <div className="space-y-1.5">
      {buttons.map((b, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {b.type === 'link' ? <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <MousePointerClick className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          <Input className="h-8 text-xs w-28" placeholder="Texto do botão" maxLength={20}
            value={b.label} onChange={e => update(i, { label: e.target.value })} />
          <Input className="h-8 text-xs flex-1" placeholder={b.type === 'link' ? 'https://…' : 'Valor que volta como resposta'}
            value={b.value} onChange={e => update(i, { value: e.target.value })} />
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
            onClick={() => onChange(buttons.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      ))}
      {buttons.length < 3 && (
        <div className="flex gap-1.5">
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => add('reply')}>
            <MousePointerClick className="w-3 h-3 mr-1" /> Resposta rápida
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => add('link')}>
            <Link2 className="w-3 h-3 mr-1" /> Botão com link
          </Button>
        </div>
      )}
    </div>
  )
}

/* ═══════════════ Montador de automação (dialog) ═══════════════ */
function FunnelBuilder({
  orgSlug, funnel, onClose, onSaved,
}: { orgSlug: string; funnel: SocialFunnel; onClose: () => void; onSaved: (f: SocialFunnel) => void }) {
  const [name, setName] = useState(funnel.name)
  const [triggerType, setTriggerType] = useState<FunnelTriggerType>(funnel.trigger_type)
  const [keywords, setKeywords] = useState((funnel.trigger_keywords || []).join(', '))
  const [createLead, setCreateLead] = useState(funnel.create_lead)
  const [steps, setSteps] = useState<EditStep[]>(
    (funnel.steps.length ? funnel.steps : [{ sort_order: 0, step_type: 'message' as const, message_text: '', ai_instructions: null, wait_for_reply: true, buttons: [] }])
      .map(s => ({ ...s, buttons: s.buttons || [], _key: nk() })),
  )
  const [saving, setSaving] = useState(false)

  function patch(key: string, p: Partial<EditStep>) {
    setSteps(list => list.map(s => s._key === key ? { ...s, ...p } : s))
  }
  function move(key: string, dir: -1 | 1) {
    setSteps(list => {
      const i = list.findIndex(s => s._key === key)
      const j = i + dir
      if (j < 0 || j >= list.length) return list
      const n = [...list]; const t = n[i]; n[i] = n[j]; n[j] = t
      return n
    })
  }
  function addStep(type: 'message' | 'ai') {
    setSteps(list => [...list, { _key: nk(), sort_order: list.length, step_type: type, message_text: type === 'message' ? '' : null, ai_instructions: type === 'ai' ? '' : null, wait_for_reply: true, buttons: [] }])
  }

  async function handleSave() {
    setSaving(true)
    const kwArr = keywords.split(',').map(k => k.trim()).filter(Boolean)
    const [u, s] = await Promise.all([
      updateFunnel(orgSlug, funnel.id, { name: name || 'Automação', trigger_type: triggerType, trigger_keywords: kwArr.length ? kwArr : null, create_lead: createLead }),
      saveFunnelSteps(orgSlug, funnel.id, steps.map(({ _key, sort_order, ...rest }) => rest)),
    ])
    setSaving(false)
    if (!u.ok) { toast.error(u.error); return }
    if (!s.ok) { toast.error(s.error); return }
    toast.success('Automação salva')
    onSaved({
      ...funnel, name: name || 'Automação', trigger_type: triggerType, create_lead: createLead,
      trigger_keywords: kwArr.length ? kwArr : null,
      steps: steps.map(({ _key, ...rest }) => rest),
    })
  }

  const isCommentish = triggerType === 'comment' || triggerType === 'comment_and_dm'

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar automação — {TRIGGER_TYPE_LABELS[triggerType]}</DialogTitle>
          <DialogDescription>
            Cada passo é enviado na sequência. Com &ldquo;esperar resposta&rdquo;, a automação pausa
            até a pessoa responder (reabrindo a janela de 24h do Instagram) — ou até ela tocar num botão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Boas-vindas + oferta" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo de automação</label>
              <Select value={triggerType} onValueChange={v => setTriggerType(v as FunnelTriggerType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_ORDER.map(t => <SelectItem key={t} value={t}>{TRIGGER_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Gatilho — palavras-chave (separadas por vírgula)</label>
            <Input value={keywords} onChange={e => setKeywords(e.target.value)}
              placeholder={isCommentish ? 'eu quero, preço — vazio = qualquer comentário' : 'preço, valor, quero — vazio = qualquer mensagem'} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={createLead} onCheckedChange={setCreateLead} />
            Criar lead no pipeline ao iniciar a automação
          </label>

          {/* Passos de resposta */}
          <div className="space-y-2">
            {steps.map((s, i) => (
              <div key={s._key} className="rounded-lg border p-3 space-y-2 bg-background">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">{i + 1}</span>
                  <div className="inline-flex rounded-md border overflow-hidden text-xs">
                    <button type="button" onClick={() => patch(s._key, { step_type: 'message' })}
                      className={`inline-flex items-center gap-1 px-2 py-1 ${s.step_type === 'message' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                      <MessageSquare className="w-3 h-3" /> Resposta fixa
                    </button>
                    <button type="button" onClick={() => patch(s._key, { step_type: 'ai' })}
                      className={`inline-flex items-center gap-1 px-2 py-1 ${s.step_type === 'ai' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                      <Sparkles className="w-3 h-3" /> Resposta manual (IA)
                    </button>
                  </div>
                  <div className="ml-auto flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => move(s._key, -1)}><ChevronUp className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === steps.length - 1} onClick={() => move(s._key, 1)}><ChevronDown className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" disabled={steps.length === 1} onClick={() => setSteps(list => list.filter(x => x._key !== s._key))}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>

                {s.step_type === 'message' ? (
                  <Textarea rows={2} placeholder="Mensagem que será enviada neste passo…"
                    value={s.message_text || ''} onChange={e => patch(s._key, { message_text: e.target.value })} />
                ) : (
                  <Textarea rows={2} placeholder="Instruções para a IA responder neste passo (ex.: apresente o pacote e pergunte a data da viagem)…"
                    value={s.ai_instructions || ''} onChange={e => patch(s._key, { ai_instructions: e.target.value })} />
                )}

                <ButtonsEditor buttons={s.buttons || []} onChange={b => patch(s._key, { buttons: b })} />

                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={s.wait_for_reply} onCheckedChange={v => patch(s._key, { wait_for_reply: v })} />
                  Esperar a resposta da pessoa antes do próximo passo
                </label>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={() => addStep('message')}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar passo
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Zap className="w-4 h-4 mr-1.5" />}
            Salvar automação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
