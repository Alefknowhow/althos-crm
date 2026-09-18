import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Clock, ExternalLink } from 'lucide-react'
import type { TravelSaleRow } from '@/actions/travel-sales'

// Cabeçalho do editor de venda — título/subtítulo guiados pelo anexo do
// redesign ("Lisboa" grande + "Cliente: X · Responsável: Y" pequeno). Os
// botões de ação principais (Voucher/Contrato/"...") ficam na mesma barra
// da direita, e a barra de abas (Dados da Reserva/Viajantes/Vouchers/
// Tarefas/Produtos) fica logo abaixo, em TravelSalesViewSaleEditor.tsx.
export default function TravelSalesViewSaleEditorHeader({
  orgSlug, s, sellerName, period, onBack, actions,
}: {
  orgSlug: string
  s: TravelSaleRow
  sellerName: string | null
  period: string | null
  onBack: () => void
  actions: React.ReactNode
}) {
  return (
    <div className="sticky top-0 bg-card border-b p-3 sm:p-4 flex items-center gap-3 z-10 flex-wrap">
      <Button variant="ghost" size="icon" className="shrink-0" title="Voltar à lista" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" />
      </Button>

      <div className="min-w-0 flex-1">
        <h2 className="font-bold truncate text-xl">{s.destination || s.client_name || 'Venda de viagem'}</h2>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span className="truncate">Cliente: {s.client_name || '—'}</span>
          {sellerName && <span>· Responsável: {sellerName}</span>}
          {period && <span>· {period}</span>}
          {s.created_at && (
            <span className="inline-flex items-center gap-1 truncate" title="Data de criação da reserva">
              <Clock className="w-3 h-3 shrink-0" /> {new Date(s.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {s.proposal_id && (
            <Link href={`/app/${orgSlug}/cotacoes/${s.proposal_id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
              <ExternalLink className="w-3 h-3" /> Ver proposta
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 shrink-0">{actions}</div>
    </div>
  )
}
