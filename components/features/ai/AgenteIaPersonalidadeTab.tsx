'use client'

/**
 * "Personalidade" tab content for AgenteIaTabs. Prop-driven, split out
 * of AgenteIaTabs.tsx.
 */

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TabsContent } from '@/components/ui/tabs'
import { Bot, RotateCcw, Check } from 'lucide-react'
import { ATTENDANT_PRESETS } from '@/lib/ai/attendant-presets'

const MODELS = [
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (rápido, barato — recomendado)' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (mais preciso, ~3x mais caro)' },
]

export function AgenteIaPersonalidadeTab({
  enabled, setEnabled, primaryGoal, setPendingPreset, persona, setPersona, setShowResetConfirm,
  business, setBusiness, model,
}: {
  enabled: boolean
  setEnabled: (v: boolean) => void
  primaryGoal: string
  setPendingPreset: (id: string) => void
  persona: string
  setPersona: (v: string) => void
  setShowResetConfirm: (v: boolean) => void
  business: string
  setBusiness: (v: string) => void
  model: string
}) {
  return (
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
  )
}
