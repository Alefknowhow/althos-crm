'use client'

/**
 * "Fluxos", "Horários", "Transferência Humana", "Ferramentas" and
 * "Memória" tab contents for AgenteIaTabs. Prop-driven, split out of
 * AgenteIaTabs.tsx.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TabsContent } from '@/components/ui/tabs'
import { Plus, X, ArrowUp, ArrowDown } from 'lucide-react'
import { DEFAULT_OUT_OF_HOURS_MESSAGE, DAY_LABELS } from '@/lib/ai/attendant-defaults'
import { ATTENDANT_TOOLS_META } from '@/lib/ai/attendant-tools-meta'

export function AgenteIaFluxosTab({
  steps, updateStep, moveStep, removeStep, addStep,
}: {
  steps: string[]
  updateStep: (i: number, value: string) => void
  moveStep: (i: number, dir: -1 | 1) => void
  removeStep: (i: number) => void
  addStep: () => void
}) {
  return (
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
  )
}

export function AgenteIaHorariosTab({
  hours, toggleDay, changeHour, outOfHours, setOutOfHours,
}: {
  hours: Record<string, [number, number] | null>
  toggleDay: (key: string) => void
  changeHour: (key: string, idx: 0 | 1, val: number) => void
  outOfHours: string
  setOutOfHours: (v: string) => void
}) {
  const WEEKDAY_ORDER = ['1', '2', '3', '4', '5', '6', '0']
  return (
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
  )
}

export function AgenteIaTransferenciaTab({
  phrases, setPhrases, maxReplies, setMaxReplies,
}: {
  phrases: string
  setPhrases: (v: string) => void
  maxReplies: number
  setMaxReplies: (n: number) => void
}) {
  return (
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
  )
}

export function AgenteIaFerramentasTab({
  enabledTools, toggleTool,
}: {
  enabledTools: Set<string> | null
  toggleTool: (name: string) => void
}) {
  return (
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
  )
}

export function AgenteIaMemoriaTab({
  memoryEnabled, setMemoryEnabled,
}: {
  memoryEnabled: boolean
  setMemoryEnabled: (v: boolean) => void
}) {
  return (
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
  )
}
