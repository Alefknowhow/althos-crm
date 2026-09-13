'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X } from 'lucide-react'
import type { FunnelEdgeCondition } from '@/lib/social/funnel-traversal'

/** Painel de edição de uma edge saindo do handle "resposta livre" (sem
 *  botão) — condição opcional por palavra-chave, ou deixa como caminho
 *  padrão. Conexões saindo de um botão específico não passam por aqui: a
 *  condição já vem fixada pelo próprio handle (ver SocialFunnelCanvas). */
export default function SocialFunnelEdgePanel({
  condition, onChange, onRemoveEdge, onClose,
}: {
  condition: FunnelEdgeCondition | undefined
  onChange: (condition: FunnelEdgeCondition | undefined) => void
  onRemoveEdge: () => void
  onClose: () => void
}) {
  const isKeyword = condition?.type === 'keyword'

  return (
    <div className="absolute top-3 right-3 z-10 w-72 rounded-md border bg-card shadow-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Conexão</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant={!isKeyword ? 'default' : 'outline'} className="text-xs h-7" onClick={() => onChange(undefined)}>
          Caminho padrão
        </Button>
        <Button
          type="button" size="sm" variant={isKeyword ? 'default' : 'outline'} className="text-xs h-7"
          onClick={() => onChange({ type: 'keyword', operator: 'contains', value: '' })}
        >
          Com palavra-chave
        </Button>
      </div>

      {isKeyword && condition.type === 'keyword' && (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-muted-foreground">Se a resposta da pessoa...</p>
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

      <div className="pt-1 border-t">
        <Button type="button" size="sm" variant="ghost" className="text-xs h-7 text-destructive hover:text-destructive w-full" onClick={onRemoveEdge}>
          Remover conexão
        </Button>
      </div>
    </div>
  )
}
