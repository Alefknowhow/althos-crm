'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, GitBranch } from 'lucide-react'
import type { AutomationEdgeCondition } from '@/lib/automations/automation-traversal'
import { INSPECTOR_PANEL_WIDTH } from './AutomationFlowNodeEditPanel'

/**
 * Painel de edição de uma conexão selecionada, no mesmo slot fixo à
 * esquerda do canvas usado pelo Inspector de nodes (AutomationFlowNodeEditPanel)
 * — evita ter dois padrões de painel (docado vs. popup flutuante) na mesma
 * tela. Só faz sentido configurar condição (palavra-chave/índice do botão)
 * quando a conexão sai de um passo "Aguardar Resposta" (é o único tipo de
 * passo que o motor ramifica de verdade — ver
 * lib/automations/automation-traversal.ts). Saindo de qualquer outro
 * passo, a conexão é só estrutural (define a ordem); o painel mostra
 * apenas a opção de remover.
 */
export default function AutomationFlowEdgePanel({
  condition, sourceIsWaitForReply, sourceIsCondition, buttonOptions, onChange, onRemoveEdge, onClose,
}: {
  condition: AutomationEdgeCondition | undefined
  sourceIsWaitForReply: boolean
  /** Conexão sai de um passo "Condição (SE)" — ramifica por verdadeiro/falso
   *  em vez de palavra-chave/botão. */
  sourceIsCondition?: boolean
  /** Rótulos reais dos botões da mensagem que precedeu o "Aguardar
   *  Resposta" (quando existir) — vira um Select em vez de um número cego,
   *  pra facilitar "quem clicou no botão X vai pra Y". */
  buttonOptions?: { label: string; value: number }[]
  onChange: (condition: AutomationEdgeCondition | undefined) => void
  onRemoveEdge: () => void
  onClose: () => void
}) {
  const isKeyword = condition?.type === 'keyword'
  const isButton = condition?.type === 'button'

  return (
    <div className="h-full shrink-0 border-r bg-card flex flex-col" style={{ width: INSPECTOR_PANEL_WIDTH }}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b shrink-0">
        <span className="w-8 h-8 rounded-lg shrink-0 grid place-items-center bg-muted text-muted-foreground">
          <GitBranch className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">Conexão</p>
          <p className="text-xs text-muted-foreground truncate">Regra de ramificação</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Fechar painel">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">

      {sourceIsCondition ? (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-muted-foreground">Segue por aqui quando a condição resultar em:</p>
          <div className="flex items-center gap-2">
            <Button
              type="button" size="sm" className="text-xs h-7 flex-1"
              variant={condition?.type === 'field_result' && condition.value === true ? 'default' : 'outline'}
              onClick={() => onChange({ type: 'field_result', value: true })}
            >
              Verdadeiro
            </Button>
            <Button
              type="button" size="sm" className="text-xs h-7 flex-1"
              variant={condition?.type === 'field_result' && condition.value === false ? 'default' : 'outline'}
              onClick={() => onChange({ type: 'field_result', value: false })}
            >
              Falso
            </Button>
          </div>
        </div>
      ) : !sourceIsWaitForReply ? (
        <p className="text-xs text-muted-foreground">
          Define a ordem do fluxo. Só passos <span className="font-medium text-foreground">Aguardar Resposta</span> podem
          ramificar por palavra-chave ou botão clicado.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <Button type="button" size="sm" variant={!condition ? 'default' : 'outline'} className="text-xs h-7" onClick={() => onChange(undefined)}>
              Caminho padrão
            </Button>
            <Button
              type="button" size="sm" variant={isKeyword ? 'default' : 'outline'} className="text-xs h-7"
              onClick={() => onChange({ type: 'keyword', operator: 'contains', value: '' })}
            >
              Palavra-chave
            </Button>
            <Button
              type="button" size="sm" variant={isButton ? 'default' : 'outline'} className="text-xs h-7"
              onClick={() => onChange({ type: 'button', buttonIndex: 0 })}
            >
              Índice do botão
            </Button>
          </div>

          {isKeyword && condition.type === 'keyword' && (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-muted-foreground">Se o texto da resposta...</p>
              <Select value={condition.operator} onValueChange={v => onChange({ ...condition, operator: v as 'eq' | 'contains' })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains" className="text-xs">contém</SelectItem>
                  <SelectItem value="eq" className="text-xs">é exatamente</SelectItem>
                </SelectContent>
              </Select>
              <Input
                className="h-8 text-xs"
                placeholder="Palavra ou frase"
                value={condition.value}
                onChange={e => onChange({ ...condition, value: e.target.value })}
              />
            </div>
          )}

          {isButton && condition.type === 'button' && (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-muted-foreground">Segue por aqui quando a pessoa clica neste botão da mensagem anterior:</p>
              {buttonOptions && buttonOptions.length > 0 ? (
                <Select value={String(condition.buttonIndex)} onValueChange={v => onChange({ type: 'button', buttonIndex: parseInt(v) })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {buttonOptions.map(b => (
                      <SelectItem key={b.value} value={String(b.value)} className="text-xs">{b.label || `Botão ${b.value + 1}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Sem botões detectados na mensagem anterior — índice manual (0 = primeiro):</p>
                  <Input
                    type="number" min={0} max={2} className="h-8 text-xs w-20"
                    value={condition.buttonIndex}
                    onChange={e => onChange({ type: 'button', buttonIndex: parseInt(e.target.value) || 0 })}
                  />
                </>
              )}
            </div>
          )}
        </>
      )}
      </div>

      <div className="px-4 py-3 border-t shrink-0">
        <Button type="button" size="sm" variant="ghost" className="text-xs h-8 text-destructive hover:text-destructive w-full" onClick={onRemoveEdge}>
          Remover conexão
        </Button>
      </div>
    </div>
  )
}
