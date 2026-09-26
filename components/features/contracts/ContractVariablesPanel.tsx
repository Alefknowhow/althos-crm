'use client'

/**
 * Painel de variáveis disponíveis no editor de modelos (issue #60, B.2) —
 * espelha as chaves que `lib/contracts/merge-fields.ts` resolve por tipo de
 * origem. Clicar copia `{{chave}}` pra área de transferência (o TipTap do
 * editor de e-mail não expõe uma API de "inserir no cursor" reaproveitável
 * aqui sem alterá-lo) — o usuário cola no ponto do modelo que quiser.
 */

import { toast } from 'sonner'
import { Info } from 'lucide-react'

const VARIABLES: { group: string; keys: string[] }[] = [
  { group: 'Reserva (sale.*)', keys: ['sale.cliente', 'sale.destino', 'sale.hotel', 'sale.data_ida', 'sale.data_volta', 'sale.valor_total', 'sale.forma_pagamento', 'sale.operadora'] },
  { group: 'Venda (sale.*)', keys: ['sale.cliente', 'sale.email', 'sale.telefone', 'sale.produto', 'sale.valor_total', 'sale.data_venda', 'sale.data_inicio_servico', 'sale.duracao_meses'] },
  { group: 'Oportunidade/Cliente (sale.*)', keys: ['sale.nome', 'sale.email', 'sale.telefone', 'sale.documento', 'sale.valor'] },
  { group: 'Organização (org.*)', keys: ['org.nome', 'org.cnpj', 'org.cadastur', 'org.telefone', 'org.email', 'org.endereco'] },
]

export default function ContractVariablesPanel() {
  function copyVar(key: string) {
    const placeholder = `{{${key}}}`
    navigator.clipboard?.writeText(placeholder).then(
      () => toast.success(`${placeholder} copiado — cole no modelo`),
      () => toast.error('Não foi possível copiar'),
    )
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-2.5 text-xs space-y-1.5">
      <div className="flex items-start gap-2 text-muted-foreground">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
        Clique numa variável pra copiar e cole no ponto do modelo — resolvidas automaticamente a partir da origem vinculada (Reserva/Venda/Oportunidade).
      </div>
      <div className="space-y-1">
        {VARIABLES.map(g => (
          <div key={g.group} className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0 w-40">{g.group}</span>
            {g.keys.map(key => (
              <button
                key={key}
                type="button"
                onClick={() => copyVar(key)}
                className="px-1.5 py-0.5 rounded bg-muted hover:bg-secondary text-[11px] font-mono"
              >
                {`{{${key}}}`}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
