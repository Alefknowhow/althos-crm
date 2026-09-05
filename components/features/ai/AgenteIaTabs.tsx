'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { updateAttendantConfig, type AttendantConfig, type KnowledgeItem } from '@/actions/ai_attendant'
import { DEFAULT_PERSONA_PROMPT } from '@/lib/ai/attendant-defaults'
import { ATTENDANT_PRESETS } from '@/lib/ai/attendant-presets'
import { ATTENDANT_TOOLS_META } from '@/lib/ai/attendant-tools-meta'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import KnowledgeManager from './KnowledgeManager'
import SandboxPlayground from './SandboxPlayground'
import QualifierSettings from './QualifierSettings'
import { AgenteIaPersonalidadeTab } from './AgenteIaPersonalidadeTab'
import {
  AgenteIaFluxosTab, AgenteIaHorariosTab, AgenteIaTransferenciaTab, AgenteIaFerramentasTab, AgenteIaMemoriaTab,
} from './AgenteIaSecondaryTabs'

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
        <AgenteIaPersonalidadeTab
          enabled={enabled} setEnabled={setEnabled}
          primaryGoal={primaryGoal} setPendingPreset={setPendingPreset}
          persona={persona} setPersona={setPersona}
          setShowResetConfirm={setShowResetConfirm}
          business={business} setBusiness={setBusiness}
          model={model}
        />

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
        <AgenteIaFluxosTab steps={steps} updateStep={updateStep} moveStep={moveStep} removeStep={removeStep} addStep={addStep} />

        {/* ── Horários ───────────────────────────────────────────────────── */}
        <AgenteIaHorariosTab hours={hours} toggleDay={toggleDay} changeHour={changeHour} outOfHours={outOfHours} setOutOfHours={setOutOfHours} />

        {/* ── Transferência Humana ───────────────────────────────────────── */}
        <AgenteIaTransferenciaTab phrases={phrases} setPhrases={setPhrases} maxReplies={maxReplies} setMaxReplies={setMaxReplies} />

        {/* ── Ferramentas ────────────────────────────────────────────────── */}
        <AgenteIaFerramentasTab enabledTools={enabledTools} toggleTool={toggleTool} />

        {/* ── Memória ────────────────────────────────────────────────────── */}
        <AgenteIaMemoriaTab memoryEnabled={memoryEnabled} setMemoryEnabled={setMemoryEnabled} />

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
