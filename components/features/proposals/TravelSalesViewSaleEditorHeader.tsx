import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  MapPin, Trash2, ArrowLeft, Receipt, ExternalLink,
  Save, Ban, Wallet, FileBadge, FileSignature, Clock,
} from 'lucide-react'
import ContratoManagerDialog from '@/components/features/reservas/ContratoManagerDialog'
import type { TravelSaleRow } from '@/actions/travel-sales'

// Cabeçalho do editor de venda (título, período, ações principais) —
// extraído de TravelSalesViewSaleEditor.tsx. Pura movimentação de JSX.
export default function TravelSalesViewSaleEditorHeader({
  orgSlug, s, sellerName, saving, period, onBack, onDelete, handleSaveClick,
  setCreditOpen, contractOpen, setContractOpen, setCancelOpen,
}: {
  orgSlug: string
  s: TravelSaleRow
  sellerName: string | null
  saving: boolean
  period: string | null
  onBack: () => void
  onDelete: () => void
  handleSaveClick: () => void
  setCreditOpen: (v: boolean) => void
  contractOpen: boolean
  setContractOpen: (v: boolean) => void
  setCancelOpen: (v: boolean) => void
}) {
  return (
    <div className="sticky top-0 bg-card/90 border-b p-3 sm:p-4 flex items-center gap-3 z-10 flex-wrap">
      <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" />
      </Button>

      <div className="min-w-0 flex-1">
        <h2 className="font-semibold truncate text-[15px] flex items-center gap-1.5">
          <Receipt className="w-4 h-4 text-primary shrink-0" /> {s.client_name || 'Venda de viagem'}
        </h2>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {s.destination && (
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" /> {s.destination}
            </span>
          )}
          {period && <span>{period}</span>}
          {sellerName && <span>Vendedor: {sellerName}</span>}
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

      {/* Ações principais — visíveis, sem esconder atrás de menus. */}
      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        <Button size="sm" disabled={saving} onClick={handleSaveClick}>
          <Save className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">{saving ? 'Salvando…' : 'Salvar'}</span>
        </Button>
        {s.contato_id && (
          <Button variant="outline" size="sm" onClick={() => setCreditOpen(true)} title="Usar crédito de cancelamento">
            <Wallet className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Usar crédito</span>
          </Button>
        )}
        <a href={`/voucher-print/${orgSlug}/${s.id}`} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" title="Gerar voucher">
            <FileBadge className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Voucher</span>
          </Button>
        </a>
        <Button variant="outline" size="sm" title="Contrato" onClick={() => setContractOpen(true)}>
          <FileSignature className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Contrato</span>
        </Button>
        <ContratoManagerDialog
          orgSlug={orgSlug}
          saleId={s.id}
          clientName={s.client_name}
          open={contractOpen}
          onOpenChange={setContractOpen}
        />
        {s.status !== 'cancelled' && (
          <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setCancelOpen(true)} title="Cancelar reserva">
            <Ban className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Cancelar</span>
          </Button>
        )}
        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={onDelete} aria-label="Excluir" title="Excluir venda">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
