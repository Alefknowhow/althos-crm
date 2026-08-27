'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Bot, RotateCcw, Check, Plus, X, ArrowUp, ArrowDown } from 'lucide-react'
import { updateAttendantConfig, type AttendantConfig, type KnowledgeItem } from '@/actions/ai_attendant'
import {
  DEFAULT_PERSONA_PROMPT,
  DEFAULT_OUT_OF_HOURS_MESSAGE,
  DAY_LABELS,
} from '@/lib/ai/attendant-defaults'
import { ATTENDANT_PRESETS } from '@/lib/ai/attendant-presets'
import { ATTENDANT_TOOLS_META } from '@/lib/ai/attendant-tools-meta'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import KnowledgeManager from './KnowledgeManager'
import SandboxPlayground from './SandboxPlayground'
import QualifierSettings from './QualifierSettings'

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


type QualifierInitial = {
  ai_enabled: boolean
  ai_provider: string
  ai_qualifier_model: string
  ai_qualifier_model_gemini: string
  ai_qualifier_prompt: string
}

export default function AgenteIaTabs({
  orgSlug,
  initial,
  knowledge,
  sandbox,
  qualifier,
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
  qualifier: QualifierInitial
  defaultTab?: string
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // As sub-abas (Personalidade/Qualificação/...) também ficam fixas, logo
  // abaixo do cabeçalho de Configurações — que também é sticky, mas tem
  // altura variável (título+abas do topo). Mede a altura real dele em vez
  // de cravar um valor fixo, que quebraria em qualquer mudança de conteúdo
  // ali (ou no mobile, onde o texto quebra linha).
  const [headerOffset, setHeaderOffset] = useState(0)
  useEffect(() => {
    const header = document.getElementById('configuracoes-sticky-header')
    if (!header) return
    const update = () => setHeaderOffset(header.offsetHeight)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  const [enabled, setEnabled] = useState(initial.is_enabled)
  const [persona, setPersona] = useState(initial.persona_prompt)
  const [primaryGoal, setPrimaryGoal] = useState(initial.primary_goal)
  const [pendingPreset, setPendingPreset] = useState<string | null>(null)
  const [business, setBusiness] = useState(initial.business_context)
  // Não editável aqui — configurado na aba Qualificação (campo
  // compartilhado, ver actions/ai_attendant.ts::getAttendantConfig).
  const [model] = useState(initial.model)
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

  // Ferramentas: null = todas habilitadas (default). Um Set explícito só
  // aparece depois que o operador mexe nos checkboxes.
  const [enabledTools, setEnabledTools] = useState<Set<string> | null>(
    initial.enabled_tools ? new Set(initial.enabled_tools) : null,
  )
  function toggleTool(name: string) {
    setEnabledTools(prev => {
      const base = prev ? new Set(prev) : new Set(ATTENDANT_TOOLS_META.map(t => t.name))
      if (base.has(name)) base.delete(name)
      else base.add(name)
      return base
    })
  }

  // Fluxos: roteiro guiado.
  const [steps, setSteps] = useState<string[]>(initial.guided_steps.length ? initial.guided_steps : [''])
  function updateStep(i: number, value: string) {
    setSteps(prev => prev.map((s, idx) => idx === i ? value : s))
  }
  function addStep() {
    setSteps(prev => [...prev, ''])
  }
  function removeStep(i: number) {
    setSteps(prev => prev.filter((_, idx) => idx !== i))
  }
  function moveStep(i: number, dir: -1 | 1) {
    setSteps(prev => {
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  // Memória.
  const [memoryEnabled, setMemoryEnabled] = useState(initial.memory_enabled)

  async function save() {
    setSaving(true)
    const res = await updateAttendantConfig(orgSlug, {
      is_enabled: enabled,
      persona_prompt: persona,
      primary_goal: primaryGoal,
      business_context: business,
      model,
      out_of_hours_message: outOfHours,
      handoff_phrases: phrases
        .split(',')
        .map(p => p.trim())
        .filter(Boolean),
      max_replies_per_conversation: maxReplies,
      enabled_tools: enabledTools ? Array.from(enabledTools) : null,
      guided_steps: steps.map(s => s.trim()).filter(Boolean),
      memory_enabled: memoryEnabled,
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

  function applyPreset(id: string) {
    const preset = ATTENDANT_PRESETS.find(p => p.id === id)
    if (!preset) return
    setPersona(preset.personaPrompt)
    setPrimaryGoal(preset.id)
    if (preset.handoffPhrases) setPhrases(preset.handoffPhrases.join(', '))
    setPendingPreset(null)
    toast.success(`Modelo "${preset.label}" aplicado — revise e clique em Salvar.`)
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
        {/* Sticky logo abaixo do cabeçalho de Configurações, colada nele
            (-mt-6 cancela o pt-6 do layout pai) — acompanha a altura real
            dele (headerOffset). Mesmo visual (fundo + pill) das abas de
            Financeiro/Dashboard (DashboardTabsShell). */}
        <div
          className="sticky z-10 -mt-6 -mx-3 sm:-mx-5 px-3 sm:px-5 pt-2 pb-2 bg-secondary/40 backdrop-blur supports-[backdrop-filter]:bg-secondary/70"
          style={{ top: headerOffset }}
        >
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="personalidade" className="px-2.5 py-1.5 text-[11px] sm:text-sm sm:px-3 sm:py-1">Personalidade</TabsTrigger>
            <TabsTrigger value="qualificacao" className="px-2.5 py-1.5 text-[11px] sm:text-sm sm:px-3 sm:py-1">Qualificação</TabsTrigger>
            <TabsTrigger value="conhecimento" className="px-2.5 py-1.5 text-[11px] sm:text-sm sm:px-3 sm:py-1">Conhecimento</TabsTrigger>
            <TabsTrigger value="fluxos" className="px-2.5 py-1.5 text-[11px] sm:text-sm sm:px-3 sm:py-1">Fluxos</TabsTrigger>
            <TabsTrigger value="horarios" className="px-2.5 py-1.5 text-[11px] sm:text-sm sm:px-3 sm:py-1">Horários</TabsTrigger>
            <TabsTrigger value="transferencia" className="px-2.5 py-1.5 text-[11px] sm:text-sm sm:px-3 sm:py-1">Transferência Humana</TabsTrigger>
            <TabsTrigger value="ferramentas" className="px-2.5 py-1.5 text-[11px] sm:text-sm sm:px-3 sm:py-1">Ferramentas</TabsTrigger>
            <TabsTrigger value="memoria" className="px-2.5 py-1.5 text-[11px] sm:text-sm sm:px-3 sm:py-1">Memória</TabsTrigger>
            <TabsTrigger value="testar" className="px-2.5 py-1.5 text-[11px] sm:text-sm sm:px-3 sm:py-1">Testar Agente</TabsTrigger>
          </TabsList>
        </div>

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
                  ? 'Ligado — o agente responde conversas reais do WhatsApp (respeitando pausa por conversa e horário comercial) e também no Testar Agente.'
                  : 'Desligado — só funciona em Testar Agente, ignorando mensagens reais.'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Modelos prontos</CardTitle>
              <CardDescription>
                Aplica uma persona pronta pra um objetivo comum. Só preenche o texto — você pode editar
                livremente depois, e nada é salvo até clicar em &quot;Salvar configuração&quot;.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {ATTENDANT_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setPendingPreset(preset.id)}
                    className="text-left rounded-lg border p-3 hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium">{preset.label}</span>
                      {primaryGoal === preset.id && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{preset.shortDescription}</p>
                  </button>
                ))}
              </div>
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
              <p className="text-xs text-muted-foreground mt-2">
                Esse mesmo texto também é usado pela qualificação automática de leads (aba Qualificação).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Modelo</CardTitle>
              <CardDescription>Configurado na aba Qualificação (compartilhado com a qualificação de leads).</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">{MODELS.find(m => m.id === model)?.label || model}</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Qualificação ───────────────────────────────────────────────── */}
        <TabsContent value="qualificacao" className="mt-4">
          <QualifierSettings orgSlug={orgSlug} initial={qualifier} />
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
          <Card>
            <CardHeader>
              <CardTitle>Roteiro guiado</CardTitle>
              <CardDescription>
                Passos que a IA usa como guia pra conduzir a conversa, na ordem. Não é um formulário
                rígido — a IA pula passos já respondidos e se adapta se o cliente mudar de assunto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-xs text-muted-foreground text-right">{i + 1}.</span>
                  <Input
                    value={step}
                    onChange={e => updateStep(i, e.target.value)}
                    placeholder="Ex: Perguntar qual serviço a pessoa procura"
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => moveStep(i, -1)} disabled={i === 0} className="h-8 w-8 shrink-0">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} className="h-8 w-8 shrink-0">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeStep(i)} className="h-8 w-8 shrink-0 text-destructive">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addStep} className="mt-2">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar passo
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Horários ───────────────────────────────────────────────────── */}
        <TabsContent value="horarios" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Horário de atendimento</CardTitle>
              <CardDescription>
                Fora desses horários, o agente responde apenas com a mensagem de &quot;fora do horário&quot; abaixo.
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
          <Card>
            <CardHeader>
              <CardTitle>Ferramentas do agente</CardTitle>
              <CardDescription>
                Escolha quais ações o agente pode executar sozinho durante a conversa, além de responder
                texto. Desligar uma ferramenta não apaga nada — só impede a IA de chamá-la.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ATTENDANT_TOOLS_META.map(tool => {
                const isEnabled = enabledTools ? enabledTools.has(tool.name) : true
                return (
                  <div key={tool.name} className="flex items-start gap-3 rounded-lg border p-3">
                    <Switch checked={isEnabled} onCheckedChange={() => toggleTool(tool.name)} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{tool.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Memória ────────────────────────────────────────────────────── */}
        <TabsContent value="memoria" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Memória entre conversas</CardTitle>
                <CardDescription>
                  Quando um atendimento é transferido pra humano, a IA guarda um resumo do que foi
                  combinado. Com a memória ligada, ela consulta esse resumo em conversas futuras do
                  mesmo cliente — pra não repetir perguntas já respondidas antes.
                </CardDescription>
              </div>
              <Switch checked={memoryEnabled} onCheckedChange={setMemoryEnabled} />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {memoryEnabled
                  ? 'Ligada — a nota fica salva no cadastro do lead e some se você desligar aqui.'
                  : 'Desligada — cada conversa começa do zero, mesmo com clientes recorrentes.'}
              </p>
            </CardContent>
          </Card>
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

      {/* Botão de salvar no fim natural do conteúdo — sem barra flutuante/sticky. */}
      <div className="flex items-center justify-end border-t px-4 py-3">
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

      <AlertDialog open={!!pendingPreset} onOpenChange={o => !o && setPendingPreset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar modelo &quot;{ATTENDANT_PRESETS.find(p => p.id === pendingPreset)?.label}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Substitui o texto da Persona (aba Personalidade) pelo modelo pronto. Nada é salvo até você
              clicar em &quot;Salvar configuração&quot; — dá pra revisar e ajustar antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingPreset && applyPreset(pendingPreset)}>
              Aplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
