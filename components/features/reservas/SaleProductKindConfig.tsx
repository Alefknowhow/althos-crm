'use client'

/**
 * Config de tipos de produto de venda (ícone/label pra grade de escolha +
 * schema de campos genérico usado pelos tipos sem formulário dedicado) e
 * os dois pedaços de UI que dependem dela — extraído de SaleProductsTab.tsx
 * (que ficou grande demais).
 */

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Package, Plane, Hotel, Car, Ship, ShieldCheck, Ticket, MapPinned,
} from 'lucide-react'
import type { SaleProductKind } from '@/actions/sale-products'

export const KIND_OPTIONS: { value: SaleProductKind; label: string; icon: typeof Plane }[] = [
  { value: 'aereo', label: 'Aéreo', icon: Plane },
  { value: 'hospedagem', label: 'Hospedagem', icon: Hotel },
  { value: 'transfer', label: 'Transfer', icon: Car },
  { value: 'passeio', label: 'Passeio', icon: MapPinned },
  { value: 'cruzeiro', label: 'Cruzeiro', icon: Ship },
  { value: 'seguro', label: 'Seguro', icon: ShieldCheck },
  { value: 'ingresso', label: 'Ingresso', icon: Ticket },
  { value: 'veiculo', label: 'Locação de veículo', icon: Car },
  { value: 'outro', label: 'Outro', icon: Package },
]

// Largura do campo condizente com o dado (issue #59/#60, ajuste visual
// pedido pelo usuário) — antes todo campo ocupava metade da largura do
// formulário (grid-cols-2), o que deixava "Nº da cabine" do mesmo tamanho
// de "Nome do hotel". xs=poucos caracteres (nº cabine, deck), sm=código
// curto (localizador, plano de alimentação), md=nome próprio (cidade,
// navio, titular), lg=texto mais longo (nome/atração sem ser observação).
export type FieldWidth = 'xs' | 'sm' | 'md' | 'lg' | 'full'
export type FieldDef = { key: string; label: string; type?: 'text' | 'date' | 'time' | 'number' | 'textarea'; required?: boolean; width?: FieldWidth }

const WIDTH_CLASS: Record<FieldWidth, string> = {
  xs: 'w-24',
  sm: 'w-36',
  md: 'w-48',
  lg: 'w-64',
  full: 'w-full basis-full',
}
const DATE_WIDTH_CLASS = 'w-44'

export const KIND_FIELDS: Record<SaleProductKind, FieldDef[]> = {
  aereo: [
    { key: 'companhia', label: 'Companhia' },
    { key: 'numero_voo', label: 'Número do voo' },
    { key: 'sentido', label: 'Sentido (ida/volta)', required: true },
    { key: 'localizador', label: 'Localizador (web check-in)' },
    { key: 'bilhete', label: 'Nº do bilhete' },
    { key: 'origem', label: 'Origem (código)', required: true },
    { key: 'destino', label: 'Destino (código)', required: true },
    { key: 'data', label: 'Data de embarque', type: 'date', required: true },
    { key: 'hora_embarque', label: 'Hora de embarque', required: true },
    { key: 'data_chegada', label: 'Data de chegada', type: 'date' },
    { key: 'hora_chegada', label: 'Hora de chegada' },
    { key: 'categoria', label: 'Categoria (econômica/executiva/...)' },
    { key: 'classe', label: 'Classe (X, Y, Z...)' },
    { key: 'bagagem', label: 'Franquia de bagagem' },
    { key: 'conexao_local', label: 'Conexão — aeroporto/cidade (se houver)' },
    { key: 'conexao_duracao', label: 'Conexão — tempo de espera (se houver)' },
    { key: 'observacoes', label: 'Observação', type: 'textarea' },
  ],
  hospedagem: [
    { key: 'hotel', label: 'Hotel' },
    { key: 'localizador', label: 'Localizador (RES...)' },
    { key: 'titular', label: 'Titular da reserva' },
    { key: 'check_in', label: 'Check-in', type: 'date' },
    { key: 'hora_checkin', label: 'Horário do check-in' },
    { key: 'check_out', label: 'Check-out', type: 'date' },
    { key: 'hora_checkout', label: 'Horário do check-out' },
    { key: 'tipo_quarto', label: 'Tipo de quarto' },
    { key: 'regime', label: 'Regime' },
    { key: 'endereco', label: 'Endereço do hotel' },
    { key: 'email', label: 'E-mail do hotel' },
    { key: 'telefone', label: 'Telefone do hotel' },
    { key: 'informacoes_adicionais', label: 'Informações adicionais', type: 'textarea' },
    { key: 'politica_cancelamento', label: 'Política de cancelamento', type: 'textarea' },
    { key: 'condicoes', label: 'Condições da reserva', type: 'textarea' },
  ],
  transfer: [
    { key: 'titular', label: 'Titular', width: 'md' },
    { key: 'codigo_reserva', label: 'Código da reserva', width: 'sm' },
    { key: 'data', label: 'Data', type: 'date' },
    { key: 'horario', label: 'Horário', width: 'xs' },
    { key: 'origem', label: 'Local de partida', width: 'md' },
    { key: 'destino', label: 'Destino', width: 'md' },
    { key: 'tipo_servico', label: 'Tipo de serviço', width: 'md' },
    { key: 'fornecedor', label: 'Empresa/motorista', width: 'md' },
    { key: 'contato', label: 'Contato (telefone/e-mail)', width: 'md' },
    { key: 'observacoes', label: 'Detalhes', type: 'textarea' },
  ],
  cruzeiro: [
    { key: 'titular', label: 'Titular', width: 'md' },
    { key: 'localizador', label: 'Localizador', width: 'sm' },
    { key: 'companhia', label: 'Companhia marítima', width: 'sm' },
    { key: 'navio', label: 'Navio', width: 'md' },
    { key: 'roteiro', label: 'Roteiro', width: 'lg' },
    { key: 'embarque_porto', label: 'Porto de embarque', width: 'md' },
    { key: 'embarque_data', label: 'Data de embarque', type: 'date' },
    { key: 'desembarque_porto', label: 'Porto de desembarque', width: 'md' },
    { key: 'desembarque_data', label: 'Data de desembarque', type: 'date' },
    { key: 'cabine', label: 'Nº da cabine', width: 'xs' },
    { key: 'categoria', label: 'Categoria da cabine', width: 'sm' },
    { key: 'deck', label: 'Deck', width: 'xs' },
    { key: 'localizacao', label: 'Localização (proa/meio/popa)', width: 'sm' },
    { key: 'vista', label: 'Vista', width: 'xs' },
    { key: 'regime', label: 'Plano de alimentação', width: 'sm' },
    { key: 'observacoes', label: 'Detalhes', type: 'textarea' },
  ],
  passeio: [
    { key: 'nome', label: 'Nome', width: 'lg' },
    { key: 'data', label: 'Data', type: 'date' },
    { key: 'fornecedor', label: 'Fornecedor', width: 'md' },
    { key: 'localizador', label: 'Localizador', width: 'sm' },
    { key: 'observacoes', label: 'Observações', width: 'lg' },
  ],
  seguro: [
    { key: 'nome', label: 'Seguradora / plano', width: 'lg' },
    { key: 'data', label: 'Vigência a partir de', type: 'date' },
    { key: 'fornecedor', label: 'Fornecedor', width: 'md' },
    { key: 'localizador', label: 'Apólice', width: 'sm' },
    { key: 'observacoes', label: 'Observações', width: 'lg' },
  ],
  ingresso: [
    { key: 'atracao', label: 'Atração', width: 'lg' },
    { key: 'titular', label: 'Titular', width: 'md' },
    { key: 'data', label: 'Data', type: 'date' },
    { key: 'codigo_reserva', label: 'Código da reserva', width: 'sm' },
    { key: 'fornecedor', label: 'Prestador de serviço', width: 'md' },
    { key: 'contato', label: 'Contato (telefone/e-mail)', width: 'md' },
    { key: 'observacoes', label: 'Detalhes', type: 'textarea' },
  ],
  veiculo: [
    { key: 'nome', label: 'Veículo', width: 'md' },
    { key: 'data', label: 'Retirada', type: 'date' },
    { key: 'fornecedor', label: 'Locadora', width: 'md' },
    { key: 'localizador', label: 'Localizador', width: 'sm' },
    { key: 'observacoes', label: 'Observações', width: 'lg' },
  ],
  outro: [
    { key: 'nome', label: 'Nome', width: 'md' },
    { key: 'data', label: 'Data', type: 'date' },
    { key: 'fornecedor', label: 'Fornecedor', width: 'md' },
    { key: 'localizador', label: 'Localizador', width: 'sm' },
    { key: 'observacoes', label: 'Observações', width: 'lg' },
  ],
}

/** Grade de tipos de produto — escolher um avança direto pro formulário
 *  (sem passo extra de confirmar um select). */
export function ProductKindPicker({ onPick }: { onPick: (kind: SaleProductKind) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {KIND_OPTIONS.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onPick(o.value)}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border p-4 hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <o.icon className="w-5 h-5 text-primary" />
          <span className="text-xs font-medium text-center">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

/** Grid genérico de campos (rótulo + input/textarea) — usado pelos tipos
 *  sem formulário dedicado (transfer, cruzeiro, passeio, etc.). */
export function GenericProductFields({
  fields, data, setData,
}: { fields: FieldDef[]; data: Record<string, string>; setData: (updater: (prev: Record<string, string>) => Record<string, string>) => void }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {fields.map(f => (
        <div key={f.key} className={cn(
          'space-y-1.5',
          f.type === 'textarea' ? 'w-full basis-full' : f.type === 'date' ? DATE_WIDTH_CLASS : WIDTH_CLASS[f.width || 'md'],
        )}>
          <Label className="text-xs">{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
          {f.type === 'textarea' ? (
            <Textarea
              rows={2}
              className="text-xs"
              value={data[f.key] || ''}
              onChange={e => setData(prev => ({ ...prev, [f.key]: e.target.value }))}
            />
          ) : (
            <Input
              type={f.type === 'date' ? 'date' : 'text'}
              value={data[f.key] || ''}
              onChange={e => setData(prev => ({ ...prev, [f.key]: e.target.value }))}
            />
          )}
        </div>
      ))}
    </div>
  )
}
