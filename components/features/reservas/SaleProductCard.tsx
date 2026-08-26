'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Circle, Pencil, Trash2, Plane, Hotel, Car, Ship, ShieldCheck, Ticket, MapPinned, Package } from 'lucide-react'
import type { SaleProduct, SaleProductKind } from '@/actions/sale-products'

const KIND_META: Record<SaleProductKind, { icon: any; label: string }> = {
  aereo: { icon: Plane, label: 'Aéreo' },
  hospedagem: { icon: Hotel, label: 'Hospedagem' },
  transfer: { icon: Car, label: 'Transfer' },
  passeio: { icon: MapPinned, label: 'Passeio' },
  cruzeiro: { icon: Ship, label: 'Cruzeiro' },
  seguro: { icon: ShieldCheck, label: 'Seguro' },
  ingresso: { icon: Ticket, label: 'Ingresso' },
  veiculo: { icon: Car, label: 'Locação de veículo' },
  outro: { icon: Package, label: 'Outro' },
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  const date = new Date(d.length <= 10 ? `${d}T12:00:00` : d)
  return date.toLocaleDateString('pt-BR')
}

function summaryLines(kind: SaleProductKind, data: Record<string, any>): { title: string; lines: string[] } {
  switch (kind) {
    case 'aereo':
      return {
        title: `${data.companhia || 'Companhia não informada'}${data.sentido ? ` (${data.sentido})` : ''}`,
        lines: Array.isArray(data.legs) && data.legs.length > 1
          ? [
              [data.legs[0]?.origem, ...data.legs.map((l: any) => l.destino)].filter(Boolean).join(' → '),
              `${data.legs.length - 1} conexão${data.legs.length > 2 ? 'ões' : ''}`,
              fmtDate(data.data),
              data.localizador ? `Localizador: ${data.localizador}` : null,
            ].filter(Boolean) as string[]
          : [
              [data.origem, data.destino].filter(Boolean).join(' → '),
              fmtDate(data.data),
              data.localizador ? `Localizador: ${data.localizador}` : null,
            ].filter(Boolean) as string[],
      }
    case 'hospedagem': {
      const nights = data.check_in && data.check_out
        ? Math.round((new Date(`${data.check_out}T12:00:00`).getTime() - new Date(`${data.check_in}T12:00:00`).getTime()) / 86400000)
        : null
      return {
        title: data.hotel || 'Hotel não informado',
        lines: [
          data.check_in && data.check_out
            ? `${fmtDate(data.check_in)}${data.hora_checkin ? ` ${data.hora_checkin}` : ''} → ${fmtDate(data.check_out)}${data.hora_checkout ? ` ${data.hora_checkout}` : ''}${nights && nights > 0 ? ` · ${nights} diária${nights > 1 ? 's' : ''}` : ''}`
            : null,
          [data.tipo_quarto, data.regime].filter(Boolean).join(' · ') || null,
          data.localizador ? `Localizador: ${data.localizador}` : null,
          data.telefone || data.endereco ? [data.telefone, data.endereco].filter(Boolean).join(' · ') : null,
        ].filter(Boolean) as string[],
      }
    }
    case 'transfer':
      return {
        title: data.fornecedor || 'Transfer',
        lines: [
          [data.origem, data.destino].filter(Boolean).join(' → '),
          data.data ? `${fmtDate(data.data)}${data.horario ? ` · ${data.horario}` : ''}` : null,
        ].filter(Boolean) as string[],
      }
    case 'cruzeiro':
      return {
        title: data.navio || data.companhia || 'Cruzeiro',
        lines: [
          data.roteiro || null,
          data.embarque_data ? `Embarque: ${fmtDate(data.embarque_data)}` : null,
          data.cabine ? `Cabine: ${data.cabine}` : null,
        ].filter(Boolean) as string[],
      }
    default:
      return {
        title: data.nome || KIND_META[kind]?.label || kind,
        lines: [data.fornecedor || null, data.data ? fmtDate(data.data) : null, data.localizador ? `Localizador: ${data.localizador}` : null].filter(Boolean) as string[],
      }
  }
}

function AereoLegs({ legs }: { legs: any[] }) {
  return (
    <div className="mt-2 space-y-1.5">
      {legs.map((l, i) => (
        <div key={i}>
          {l.escala_local && (
            <div className="text-[10px] text-muted-foreground italic py-1">
              Espera de {l.escala_duracao || '—'} em {l.escala_local}
            </div>
          )}
          <div className="rounded-md border bg-muted/20 px-2.5 py-1.5 text-xs space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{l.companhia}{l.numero ? ` · Voo ${l.numero}` : ''}</span>
              {l.duracao && <span className="text-muted-foreground shrink-0">{l.duracao}</span>}
            </div>
            <div className="flex items-center justify-between gap-2 text-muted-foreground">
              <span>{l.origem}{l.hora_embarque ? ` ${l.hora_embarque}` : ''} → {l.destino}{l.hora_chegada ? ` ${l.hora_chegada}` : ''}</span>
            </div>
            {(l.localizador_checkin || l.bilhete || l.bagagem) && (
              <div className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground pt-0.5">
                {l.localizador_checkin && <span>Check-in: {l.localizador_checkin}</span>}
                {l.bilhete && <span>Bilhete: {l.bilhete}</span>}
                {l.bagagem && <span>{l.bagagem}</span>}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function SaleProductCard({
  product, onEdit, onDelete, onToggleStatus,
}: {
  product: SaleProduct
  onEdit: () => void
  onDelete: () => void
  onToggleStatus: () => void
}) {
  const meta = KIND_META[product.kind] || KIND_META.outro
  const Icon = meta.icon
  const data = product.data || {}
  const { title, lines } = summaryLines(product.kind, data)
  const confirmed = product.status === 'confirmed'
  const legs = product.kind === 'aereo' && Array.isArray(data.legs) ? data.legs : null

  return (
    <div className="rounded-lg border p-3 flex items-start gap-3">
      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{meta.label}</Badge>
        </div>
        <div className="text-sm font-medium mt-1 truncate">{title}</div>
        {lines.map((l, i) => (
          <div key={i} className="text-xs text-muted-foreground truncate">{l}</div>
        ))}
        {legs && legs.length > 0 && <AereoLegs legs={legs} />}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onToggleStatus}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          title={confirmed ? 'Marcar como pendente' : 'Marcar como confirmado'}
        >
          {confirmed ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Circle className="w-4 h-4" />}
        </button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} aria-label="Editar produto">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={onDelete} aria-label="Excluir produto">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
