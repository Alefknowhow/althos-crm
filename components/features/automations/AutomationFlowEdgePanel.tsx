'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, GripHorizontal } from 'lucide-react'
import type { AutomationEdgeCondition } from '@/lib/automations/automation-traversal'
import { useDraggablePosition } from './useDraggablePanel'

/**
 * Painel de edição de uma conexão selecionada — só faz sentido configurar
 * condição (palavra-chave/índice do botão) quando a conexão sai de um passo
 * "Aguardar Resposta" (é o único tipo de passo que o motor ramifica de
 * verdade — ver lib/automations/automation-traversal.ts). Saindo de
 * qualquer outro passo, a conexão é só estrutural (define a ordem); o
 * painel mostra apenas a opção de remover.
 */
const PANEL_WIDTH = 440

export default function AutomationFlowEdgePanel({
  condition, sourceIsWaitForReply, buttonOptions, onChange, onRemoveEdge, onClose, anchor,
}: {
  condition: AutomationEdgeCondition | undefined
  sourceIsWaitForReply: boolean
  /** Rótulos reais dos botões da mensagem que precedeu o "Aguardar
   *  Resposta" (quando existir) — vira um Select em vez de um número cego,
   *  pra facilitar "quem clicou no botão X vai pra Y". */
  buttonOptions?: { label: string; value: number }[]
  onChange: (condition: AutomationEdgeCondition | undefined) => void
  onRemoveEdge: () => void
  onClose: () => void
  anchor?: { x: number; y: number; containerWidth: number; containerHeight: number }
}) {
  const isKeyword = condition?.type === 'keyword'
  const isButton = condition?.type === 'button'

  const anchorStyle = anchor
    ? {
        top: Math.max(12, Math.min(anchor.y, anchor.containerHeight - 120)),
        left: Math.max(12, Math.min(anchor.x + 16, anchor.containerWidth - PANEL_WIDTH - 12)),
      }
    : { top: 12, right: 12 }
  const { style, onHeaderMouseDown } = useDraggablePosition('left' in anchorStyle ? anchorStyle as { top: number; left: number } : undefined)

  return (
    <div
      className="absolute z-10 rounded-md border bg-card shadow-lg p-3 space-y-3"
      style={{ width: PANEL_WIDTH, ...(style ?? anchorStyle) }}
    >
      <div onMouseDown={onHeaderMouseDown} className="flex items-center justify-between cursor-move select-none -mx-3 -mt-3 px-3 pt-3 pb-1">
        <div className="flex items-center gap-1.5">
          <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground/50" />
          <p className="text-sm font-semibold">Conexão</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
          <X className="w-4 h-4" />
        </button>
      </div>

      {!sourceIsWaitForReply ? (
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

      <div className="pt-1 border-t">
        <Button type="button" size="sm" variant="ghost" className="text-xs h-7 text-destructive hover:text-destructive w-full" onClick={onRemoveEdge}>
          Remover conexão
        </Button>
      </div>
    </div>
  )
}
