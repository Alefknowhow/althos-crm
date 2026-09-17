'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus } from 'lucide-react'
import type { Step } from './AutomationFlowMeta'
import type { AutomationFlowEdge } from '@/lib/automations/automation-traversal'

/**
 * Campos de configuração dos passos "DM do Instagram" e "Aguardar Resposta"
 * — extraídos de AutomationFlowStepConfig.tsx só por tamanho de arquivo
 * (limite de 350 linhas do projeto), sem mudança de comportamento.
 */

/** Mensagem + até 3 botões de um passo "DM do Instagram" — mesmo shape de
 *  MessageButton (lib/social/instagram.ts), pra poder ramificar depois num
 *  "Aguardar Resposta" pelo índice do botão clicado. */
export function InstagramDmFields({
  step, patch, labelClass,
}: {
  step: Step
  patch: (u: Record<string, any>) => void
  labelClass: string
}) {
  const buttons: { type: 'reply' | 'link'; label: string; value: string }[] = step.config.buttons || []

  function setButtons(next: typeof buttons) { patch({ buttons: next }) }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className={labelClass}>Mensagem</Label>
        <textarea
          placeholder="Ex.: Oi {{lead.name}}! Aqui está o que você pediu 👇"
          value={step.config.message || ''}
          onChange={e => patch({ message: e.target.value })}
          rows={3}
          className="w-full rounded-md border border-input bg-input/25 p-2.5 text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label className={labelClass}>Botões (até 3)</Label>
        {buttons.map((b, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Select value={b.type} onValueChange={v => setButtons(buttons.map((x, j) => j === i ? { ...x, type: v as 'reply' | 'link' } : x))}>
              <SelectTrigger className="w-28 shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reply">Resposta</SelectItem>
                <SelectItem value="link">Link</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Rótulo" value={b.label} onChange={e => setButtons(buttons.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
            <Input placeholder={b.type === 'link' ? 'https://...' : 'valor interno'} value={b.value} onChange={e => setButtons(buttons.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
            <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => setButtons(buttons.filter((_, j) => j !== i))}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {buttons.length < 3 && (
          <Button type="button" variant="outline" size="sm" onClick={() => setButtons([...buttons, { type: 'reply', label: '', value: '' }])}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar botão
          </Button>
        )}
      </div>
    </div>
  )
}

/** Ramificação de um "Aguardar Resposta": cada linha é uma edge do grafo
 *  (lib/automations/automation-traversal.ts) saindo deste step — por índice
 *  de botão (resposta a um "DM do Instagram"/"WhatsApp" anterior) ou por
 *  palavra-chave no texto da resposta. A última linha sem condição é o
 *  caminho padrão; sem nenhuma edge, o motor segue a ordem normal do array. */
export function BranchFields({
  step, steps, index, edges, setEdges, labelClass,
}: {
  step: Step
  steps: Step[]
  index: number
  edges: AutomationFlowEdge[]
  setEdges: (next: AutomationFlowEdge[]) => void
  labelClass: string
}) {
  const targets = steps.filter((_, i) => i !== index)

  function updateEdge(i: number, patch: Partial<AutomationFlowEdge>) {
    setEdges(edges.map((e, j) => j === i ? { ...e, ...patch } as AutomationFlowEdge : e))
  }

  function addEdge() {
    setEdges([...edges, { id: `edge_${Date.now()}`, from: step.id, to: 'end', condition: { type: 'keyword', operator: 'contains', value: '' } }])
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Sem ramificação nenhuma, a automação continua na ordem normal quando a resposta chegar.
        Adicione ramos pra desviar o fluxo conforme o botão clicado ou o texto respondido.
      </p>
      {edges.map((e, i) => (
        <div key={e.id} className="p-2.5 rounded-lg border border-border space-y-2">
          <div className="flex gap-2 items-center">
            <Select
              value={e.condition?.type === 'button' ? 'button' : 'keyword'}
              onValueChange={v => updateEdge(i, {
                condition: v === 'button'
                  ? { type: 'button', buttonIndex: 0 }
                  : { type: 'keyword', operator: 'contains', value: '' },
              })}
            >
              <SelectTrigger className="w-32 shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="keyword">Texto contém</SelectItem>
                <SelectItem value="button">Índice do botão</SelectItem>
              </SelectContent>
            </Select>
            {e.condition?.type === 'button' ? (
              <Input type="number" min={0} max={2} className="w-20" value={e.condition.buttonIndex}
                onChange={ev => updateEdge(i, { condition: { type: 'button', buttonIndex: parseInt(ev.target.value) || 0 } })} />
            ) : (
              <Input placeholder="palavra-chave" value={e.condition?.type === 'keyword' ? e.condition.value : ''}
                onChange={ev => updateEdge(i, { condition: { type: 'keyword', operator: 'contains', value: ev.target.value } })} />
            )}
            <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => setEdges(edges.filter((_, j) => j !== i))}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-1">
            <Label className={labelClass}>Vai para</Label>
            <Select value={e.to} onValueChange={v => updateEdge(i, { to: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="end">Fim do fluxo</SelectItem>
                {targets.map(t => <SelectItem key={t.id} value={t.id}>{t.type} ({t.id.slice(-5)})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addEdge}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar ramo
      </Button>
    </div>
  )
}
