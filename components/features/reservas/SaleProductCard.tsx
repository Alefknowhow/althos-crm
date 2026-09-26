'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Circle, Pencil, Trash2 } from 'lucide-react'
import type { SaleProduct, SaleProductKind } from '@/actions/sale-products'
import { cityFromAirportCode } from '@/lib/airports'
import { cn } from '@/lib/utils'
import { PRODUCT_KIND_META } from '@/lib/travel/product-types'

// Mesmos rótulos usados no formulário (SaleProductDedicatedForms.tsx) —
// duplicado aqui só pra exibição, sem acoplar os dois arquivos.
const CABIN_LABEL: Record<string, string> = {
  economica: 'Econômica', premium: 'Premium Economy', executiva: 'Executiva', primeira: 'Primeira Classe',
}
const BAGGAGE_LABEL: Record<string, string> = {
  item_pessoal: 'Item pessoal', mao: 'Bagagem de mão', despachada: 'Bagagem despachada',
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  const date = new Date(d.length <= 10 ? `${d}T12:00:00` : d)
  return date.toLocaleDateString('pt-BR')
}

function summaryLines(kind: SaleProductKind, data: Record<string, any>): { title: string; lines: string[] } {
  switch (kind) {
    case 'aereo':
      // Trecho único (o caso normal, preenchido pelo formulário) ganha um
      // layout dedicado em linha só — ver AereoInlineDetails — então aqui só
      // precisa cobrir o caso de múltiplos trechos extraídos por OCR.
      return {
        title: `${data.companhia || 'Companhia não informada'}${data.sentido ? ` (${data.sentido})` : ''}`,
        lines: Array.isArray(data.legs) && data.legs.length > 1
          ? [
              [data.legs[0]?.origem, ...data.legs.map((l: any) => l.destino)].filter(Boolean).join(' → '),
              `${data.legs.length - 1} conexão${data.legs.length > 2 ? 'ões' : ''}`,
              fmtDate(data.data),
              data.localizador ? `Localizador: ${data.localizador}` : null,
            ].filter(Boolean) as string[]
          : [],
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
          data.codigo_reserva ? `Código: ${data.codigo_reserva}` : null,
          data.contato || null,
        ].filter(Boolean) as string[],
      }
    case 'cruzeiro':
      return {
        title: data.navio || data.companhia || 'Cruzeiro',
        lines: [
          data.roteiro || null,
          data.embarque_data ? `Embarque: ${fmtDate(data.embarque_data)}${data.embarque_porto ? ` · ${data.embarque_porto}` : ''}` : null,
          [data.cabine ? `Cabine ${data.cabine}` : null, data.categoria, data.regime].filter(Boolean).join(' · ') || null,
          data.localizador ? `Localizador: ${data.localizador}` : null,
        ].filter(Boolean) as string[],
      }
    case 'ingresso':
      return {
        title: data.atracao || data.nome || 'Ingresso',
        lines: [
          data.data ? fmtDate(data.data) : null,
          data.codigo_reserva ? `Código: ${data.codigo_reserva}` : null,
          data.fornecedor || null,
          data.contato || null,
        ].filter(Boolean) as string[],
      }
    default:
      return {
        title: data.nome || PRODUCT_KIND_META[kind]?.label || kind,
        lines: [data.fornecedor || null, data.data ? fmtDate(data.data) : null, data.localizador ? `Localizador: ${data.localizador}` : null].filter(Boolean) as string[],
      }
  }
}

/** Detalhes do trecho único (produto 'aereo' preenchido pelo formulário,
 *  sem `data.legs[]`) — todas as informações organizadas ao longo da
 *  linha (chips flex-wrap), em vez de uma embaixo da outra, pra caber mais
 *  detalhe sem estourar a altura do card. */
function AereoInlineDetails({ data }: { data: Record<string, any> }) {
  const originCity = cityFromAirportCode(data.origem)
  const destCity = cityFromAirportCode(data.destino)
  const route = [data.origem, data.destino].filter(Boolean).join(' → ')
  if (!route && !data.data) return null
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
      {data.numero_voo && <span className="font-medium text-foreground">Voo {data.numero_voo}</span>}
      {route && (
        <span className="font-medium text-foreground">
          {data.origem}{originCity ? ` (${originCity})` : ''} → {data.destino}{destCity ? ` (${destCity})` : ''}
        </span>
      )}
      {data.data && (
        <span>
          {fmtDate(data.data)}{data.hora_embarque ? ` ${data.hora_embarque}` : ''}
          {(data.data_chegada || data.hora_chegada) && (
            <> → {fmtDate(data.data_chegada) || fmtDate(data.data)}{data.hora_chegada ? ` ${data.hora_chegada}` : ''}</>
          )}
        </span>
      )}
      {data.conexao_local && <span>Conexão: {data.conexao_local}{data.conexao_duracao ? ` (${data.conexao_duracao})` : ''}</span>}
      {(data.categoria || data.classe) && (
        <span>{[CABIN_LABEL[data.categoria] || data.categoria, data.classe ? `Classe ${data.classe}` : null].filter(Boolean).join(' · ')}</span>
      )}
      {data.localizador && <span>Localizador: <span className="text-foreground">{data.localizador}</span></span>}
      {data.bilhete && <span>Bilhete: {data.bilhete}</span>}
      {Array.isArray(data.bagagem) && data.bagagem.length > 0 && (
        <span>{data.bagagem.map((k: string) => BAGGAGE_LABEL[k] || k).join(' + ')}</span>
      )}
      {typeof data.bagagem === 'string' && data.bagagem && <span>{data.bagagem}</span>}
      {data.observacoes && <span className="italic">{data.observacoes}</span>}
    </div>
  )
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
  product, onEdit, onDelete, onToggleStatus, readOnly = false,
}: {
  product: SaleProduct
  onEdit?: () => void
  onDelete?: () => void
  onToggleStatus?: () => void
  /** Sem botões de ação (editar/excluir/status) — usado em visualizações
   *  fora do editor de Reservas, como o painel de detalhe de Embarques. */
  readOnly?: boolean
}) {
  const meta = PRODUCT_KIND_META[product.kind] || PRODUCT_KIND_META.outro
  const Icon = meta.icon
  const data = product.data || {}
  const { title, lines } = summaryLines(product.kind, data)
  const confirmed = product.status === 'confirmed'
  const legs = product.kind === 'aereo' && Array.isArray(data.legs) ? data.legs : null

  return (
    <div className="rounded-xl bg-muted/50 p-3 flex items-start gap-3">
      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: meta.color }}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">{meta.label}</div>
        <div className="text-sm mt-0.5 truncate">{title}</div>
        {lines.map((l, i) => (
          <div key={i} className="text-xs text-muted-foreground truncate">{l}</div>
        ))}
        {product.kind === 'aereo' && !legs && <AereoInlineDetails data={data} />}
        {legs && legs.length > 0 && <AereoLegs legs={legs} />}
      </div>
      {!readOnly && (
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
      )}
      {readOnly && (
        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 shrink-0', confirmed ? 'text-success border-success/30' : 'text-muted-foreground')}>
          {confirmed ? 'Confirmado' : 'Pendente'}
        </Badge>
      )}
    </div>
  )
}
