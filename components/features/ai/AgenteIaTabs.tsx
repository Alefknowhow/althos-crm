'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Bot, RotateCcw, Workflow, Wrench, Database, type LucideIcon } from 'lucide-react'
import { updateAttendantConfig, type AttendantConfig, type KnowledgeItem } from '@/actions/ai_attendant'
import {
  DEFAULT_PERSONA_PROMPT,
  DEFAULT_OUT_OF_HOURS_MESSAGE,
  DAY_LABELS,
} from '@/lib/ai/attendant-defaults'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import KnowledgeManager from './KnowledgeManager'
import SandboxPlayground from './SandboxPlayground'

const MODELS = [
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (rápido, barato — recomendado)' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (mais preciso, ~3x mais caro)' },
]

const WEEKDAY_ORDER = ['1', '2', '3', '4', '5', '6', '0'] // Seg → Dom

type SandboxSession = { id: string; title: string | null; simulated_lead: any; created_at: string; updated_at: string }
type SandboxMessage = {
  id: string; role: 'user' | 'assistant' | 'system'; content: string
  tokens_input: number | null; tokens_output: number | null; cache_read_tokens: number | null
  cost_cents: number | null; model: string | null; created_at: string
}

/** Aba ainda sem funcionalidade real por trás — evita fingir um recurso que não existe. */
function ComingSoon({ title, description, icon: Icon }: { title: string; description: string; icon: LucideIcon }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
        </div>
        <span className="inline-flex items-center rounded-full border border-dashed border-muted-foreground/30 bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          Em breve
        </span>
      </CardContent>
    </Card>
  )
}

export default function AgenteIaTabs({
  orgSlug,
  initial,
  knowledge,
  sandbox,
  defaultTab = 'personalidade',
}: {
  orgSlug: string
  initial: AttendantConfig
  knowledge: KnowledgeItem[]
  sandbox: {
    hasApiKey: boolean
    sessions: SandboxSession[]
    activeSessionId: string
    initialMessages: SandboxMessage[]
  }
  defaultTab?: string
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const [enabled, setEnabled] = useState(initial.is_enabled)
  const [persona, setPersona] = useState(initial.persona_prompt)
  const [business, setBusiness] = useState(initial.business_context)
  const [model, setModel] = useState(initial.model)
  const [outOfHours, setOutOfHours] = useState(initial.out_of_hours_message)
  const [phrases, setPhrases] = useState((initial.handoff_phrases || []).join(', '))
  const [maxReplies, setMaxReplies] = useState(initial.max_replies_per_conversation)
  const [hours, setHours] = useState<Record<string, [number, number] | null>>(() => {
    const out: Record<string, [number, number] | null> = {}
    for (const k of WEEKDAY_ORDER) {
      const v = (initial.working_hours as any)[k]
      out[k] = Array.isArray(v) && v.length === 2 ? [v[0], v[1]] : null
    }
    return out
  })

  async function save() {
    setSaving(true)
    const res = await updateAttendantConfig(orgSlug, {
      is_enabled: enabled,
      persona_prompt: persona,
      business_context: business,
      model,
      out_of_hours_message: outOfHours,
      handoff_phrases: phrases
        .split(',')
        .map(p => p.trim())
        .filter(Boolean),
      max_replies_per_conversation: maxReplies,
      working_hours: Object.fromEntries(
        Object.entries(hours).filter(([, v]) => v !== null),
      ) as any,
    })
    setSaving(false)
    if (res.ok) {
      toast.success('Configuração salva')
      router.refresh()
    } else {
      toast.error(res.error || 'Erro ao salvar')
    }
  }

  function toggleDay(key: string) {
    setHours(prev => ({ ...prev, [key]: prev[key] ? null : [9, 18] }))
  }

  function changeHour(key: string, idx: 0 | 1, val: number) {
    setHours(prev => {
      const cur = prev[key] || [9, 18]
      const next: [number, number] = idx === 0 ? [val, cur[1]] : [cur[0], val]
      return { ...prev, [key]: next }
    })
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="personalidade">Personalidade</TabsTrigger>
          <TabsTrigger value="conhecimento">Conhecimento</TabsTrigger>
          <TabsTrigger value="fluxos">Fluxos</TabsTrigger>
          <TabsTrigger value="horarios">Horários</TabsTrigger>
          <TabsTrigger value="transferencia">Transferência Humana</TabsTrigger>
          <TabsTrigger value="ferramentas">Ferramentas</TabsTrigger>
          <TabsTrigger value="memoria">Memória</TabsTrigger>
          <TabsTrigger value="testar">Testar Agente</TabsTrigger>
        </TabsList>

        {/* ── Personalidade ──────────────────────────────────────────────── */}
        <TabsContent value="personalidade" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle>Status do Agente</CardTitle>
                  <CardDescription>Liga ou desliga o agente como um todo.</CardDescription>
                </div>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {enabled
                  ? 'Ligado — o agente responderá conversas pelo WhatsApp (quando a API estiver conectada) e pelo Testar Agente.'
                  : 'Desligado — só funciona em Testar Agente, ignorando mensagens reais.'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Persona</CardTitle>
              <CardDescription>
                A personalidade e regras do agente. Use o template e ajuste para o tom da sua agência/cliente.
                Variáveis disponíveis: <code>{'{{org_nome}}'}</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={16}
                value={persona}
                onChange={e => setPersona(e.target.value)}
                className="font-mono text-xs resize-y"
              />
              <Button variant="ghost" size="sm" onClick={() => setShowResetConfirm(true)} className="mt-2">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Restaurar padrão
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contexto do negócio</CardTitle>
              <CardDescription>
                Descreva produto/serviço, ICP, faixa de preço, diferenciais. Esse texto fica sempre no
                contexto — para FAQ detalhada, use a aba Conhecimento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={6}
                value={business}
                onChange={e => setBusiness(e.target.value)}
                placeholder="Ex: Clínica de estética em Florianópolis. Atende botox, preenchimento, harmonização. Ticket médio R$ 800-2500. Atendemos das 9h às 19h. Diferencial: equipe formada por médicos."
                className="font-mono text-xs resize-y"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Modelo</CardTitle>
            </CardHeader>
            <CardContent>
              <select
                className="flex h-9 w-full rounded-none border border-input bg-transparent px-3 text-sm"
                value={model}
                onChange={e => setModel(e.target.value)}
              >
                {MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Conhecimento ───────────────────────────────────────────────── */}
        <TabsContent value="conhecimento" className="mt-4">
          <div className="space-y-1 mb-4">
            <h2 className="text-lg font-semibold">Base de Conhecimento</h2>
            <p className="text-sm text-muted-foreground">
              Cada entrada Q&A é injetada no contexto do agente. Use para preços, procedimentos,
              horários, políticas — qualquer info que a IA precisa saber para responder bem.
            </p>
          </div>
          <KnowledgeManager orgSlug={orgSlug} initial={knowledge} />
        </TabsContent>

        {/* ── Fluxos ─────────────────────────────────────────────────────── */}
        <TabsContent value="fluxos" className="mt-4">
          <ComingSoon
            icon={Workflow}
            title="Fluxos guiados"
            description="Monte roteiros de conversa com etapas fixas (ex.: qualificação, agendamento) para o agente seguir em vez de responder livremente."
          />
        </TabsContent>

        {/* ── Horários ───────────────────────────────────────────────────── */}
        <TabsContent value="horarios" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Horário de atendimento</CardTitle>
              <CardDescription>
                Fora desses horários, o agente responde apenas com a mensagem de "fora do horário" abaixo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {WEEKDAY_ORDER.map(k => {
                const range = hours[k]
                return (
                  <div key={k} className="flex items-center gap-3">
                    <Switch checked={!!range} onCheckedChange={() => toggleDay(k)} />
                    <span className="text-sm w-20">{DAY_LABELS[k]}</span>
                    {range ? (
                      <>
                        <Input
                          type="number"
                          min={0}
                          max={23}
                          value={range[0]}
                          onChange={e => changeHour(k, 0, parseInt(e.target.value) || 0)}
                          className="w-20"
                        />
                        <span className="text-muted-foreground text-xs">às</span>
                        <Input
                          type="number"
                          min={0}
                          max={23}
                          value={range[1]}
                          onChange={e => changeHour(k, 1, parseInt(e.target.value) || 0)}
                          className="w-20"
                        />
                        <span className="text-xs text-muted-foreground">h</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Fechado</span>
                    )}
                  </div>
                )
              })}

              <div className="space-y-2 pt-2 border-t">
                <Label>Mensagem fora do horário</Label>
                <Textarea
                  rows={3}
                  value={outOfHours}
                  onChange={e => setOutOfHours(e.target.value)}
                  placeholder={DEFAULT_OUT_OF_HOURS_MESSAGE}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Transferência Humana ───────────────────────────────────────── */}
        <TabsContent value="transferencia" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Escalação para humano</CardTitle>
              <CardDescription>
                Palavras-chave que, se aparecerem na mensagem do cliente, escalam a conversa para humano
                imediatamente (separadas por vírgula).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                value={phrases}
                onChange={e => setPhrases(e.target.value)}
                placeholder="humano, atendente, responsável, reclamação"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Limite anti-loop</CardTitle>
              <CardDescription>
                Após esse número de respostas na mesma conversa, o agente para de responder
                automaticamente e escala para humano.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Label>Máximo de respostas por conversa</Label>
              <Input
                type="number"
                min={1}
                max={200}
                value={maxReplies}
                onChange={e => setMaxReplies(parseInt(e.target.value) || 30)}
                className="mt-2"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Ferramentas ────────────────────────────────────────────────── */}
        <TabsContent value="ferramentas" className="mt-4">
          <ComingSoon
            icon={Wrench}
            title="Ferramentas do agente"
            description="Escolha quais ações o agente pode executar sozinho — consultar pipeline, agendar horários, buscar pedidos — além de só responder texto."
          />
        </TabsContent>

        {/* ── Memória ────────────────────────────────────────────────────── */}
        <TabsContent value="memoria" className="mt-4">
          <ComingSoon
            icon={Database}
            title="Memória entre conversas"
            description="Configure o que o agente deve lembrar de um cliente entre atendimentos diferentes (preferências, histórico, combinados anteriores)."
          />
        </TabsContent>

        {/* ── Testar Agente ──────────────────────────────────────────────── */}
        <TabsContent value="testar" className="mt-4">
          <div className="h-[70vh] border rounded-none overflow-hidden">
            <SandboxPlayground
              orgSlug={orgSlug}
              hasApiKey={sandbox.hasApiKey}
              attendantEnabled={enabled}
              sessions={sandbox.sessions}
              activeSessionId={sandbox.activeSessionId}
              initialMessages={sandbox.initialMessages}
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-end sticky bottom-4 bg-card border px-4 py-3">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar configuração'}
        </Button>
      </div>

      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar persona padrão?</AlertDialogTitle>
            <AlertDialogDescription>Suas alterações serão perdidas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setPersona(DEFAULT_PERSONA_PROMPT); setShowResetConfirm(false) }}
            >
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
