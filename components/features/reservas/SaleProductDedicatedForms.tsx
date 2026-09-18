'use client'

/**
 * Formulários dedicados dos produtos "Aéreo" e "Hospedagem" — mesmo
 * agrupamento/estilo visual dos blocos equivalentes em Cotações
 * (QuotationEditorFlightsBlock.tsx / QuotationEditorLodgingsBlock.tsx),
 * adaptados ao schema flat de `sale_products.data`. Extraído de
 * SaleProductsTab.tsx (que ficou grande demais).
 */

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Backpack, Briefcase, PackageCheck } from 'lucide-react'
import { cityFromAirportCode } from '@/lib/airports'

// Mesmas opções de regime de hospedagem do bloco Hospedagens em Cotações
// (QuotationEditorFields.tsx) — duplicado aqui pra não importar esse módulo
// inteiro (dnd-kit, upload, editor rich-text) só por uma constante.
const BOARD_OPTIONS = ['Somente Quarto', 'Café da manhã', 'Meia pensão', 'Pensão completa', 'All inclusive']

// Mesmas categorias de cabine do bloco Aéreo em Cotações
// (PublicQuotationHelpers.tsx `CABIN_LABELS`) — duplicado aqui pelo mesmo
// motivo do BOARD_OPTIONS acima.
const CABIN_OPTIONS: { value: string; label: string }[] = [
  { value: 'economica', label: 'Econômica' },
  { value: 'premium', label: 'Premium Economy' },
  { value: 'executiva', label: 'Executiva' },
  { value: 'primeira', label: 'Primeira Classe' },
]

// Mesmas franquias do BaggagePicker em Cotações (QuotationEditorMedia.tsx)
// — botões de seleção múltipla em vez de texto livre.
const BAGGAGE_OPTIONS: { key: string; label: string; icon: typeof Backpack }[] = [
  { key: 'item_pessoal', label: 'Item pessoal (mochila)', icon: Backpack },
  { key: 'mao', label: 'Bagagem de mão (10 kg)', icon: Briefcase },
  { key: 'despachada', label: 'Bagagem despachada (23 kg)', icon: PackageCheck },
]

function parseBaggage(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value : []
}

/** Franquias de bagagem incluídas — seleção múltipla por botão, mesmo
 *  padrão do BaggagePicker de Cotações. */
function BaggagePicker({ value, onChange }: { value: string | string[] | undefined; onChange: (v: string[]) => void }) {
  const selected = parseBaggage(value)
  return (
    <div className="flex gap-1">
      {BAGGAGE_OPTIONS.map(o => {
        const on = selected.includes(o.key)
        const Icon = o.icon
        return (
          <button
            key={o.key}
            type="button"
            title={o.label}
            onClick={() => onChange(on ? selected.filter(k => k !== o.key) : [...selected, o.key])}
            className={`inline-flex items-center justify-center w-9 h-9 rounded-md border transition-colors ${
              on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            <Icon className="w-4 h-4" />
          </button>
        )
      })}
    </div>
  )
}

/** Data+hora combinados num só campo — mesmo padrão do "Partida/Chegada
 *  (data e hora)" do bloco Aéreo em Cotações: um único `datetime-local`
 *  que grava em dois campos flat (data separada da hora). */
function DateTimeField({
  label, required, date, time, onChange,
}: { label: string; required?: boolean; date: string; time: string; onChange: (date: string, time: string) => void }) {
  return (
    <Field label={label} required={required}>
      <Input
        type="datetime-local"
        value={date && time ? `${date}T${time}` : ''}
        onChange={e => {
          const [d, t] = e.target.value.split('T')
          onChange(d || '', t || '')
        }}
      />
    </Field>
  )
}

/** Campo rotulado — mesmo padrão visual de `F` em Cotações
 *  (QuotationEditorFields.tsx), pra dar consistência entre os dois
 *  formulários de produto/serviço. */
function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive"> *</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/80">{hint}</p>}
    </div>
  )
}

/** Campo de sigla de aeroporto — igual ao de Cotações: maiúsculas, até 3
 *  letras, e mostra a cidade correspondente embaixo assim que reconhece o
 *  código (lib/airports.ts). */
function AirportCodeField({
  label, required, value, onChange, placeholder,
}: { label: string; required?: boolean; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Field label={label} required={required} hint={cityFromAirportCode(value) || (value ? 'sigla não reconhecida' : undefined)}>
      <Input maxLength={3} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value.toUpperCase())} />
    </Field>
  )
}

export type ProductFieldSetter = (key: string, value: string | string[]) => void
export type ProductFieldsSetter = (patch: Record<string, string | string[]>) => void

/** Formulário do produto "Aéreo" — mesmo agrupamento/estilo do bloco Aéreo
 *  de Cotações (QuotationEditorFlightsBlock.tsx): cia/nº/sentido/localizador
 *  numa linha, origem/destino/conexão com cidade auto-preenchida na
 *  seguinte, partida/chegada como data+hora combinados, categoria/classe da
 *  cabine e por fim bilhete/bagagem (botões)/observação. */
export function AereoFormFields({
  data, set, setMany,
}: { data: Record<string, string | string[]>; set: ProductFieldSetter; setMany: ProductFieldsSetter }) {
  const str = (key: string) => (typeof data[key] === 'string' ? data[key] as string : '')
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Field label="Companhia"><Input placeholder="GOL" value={str('companhia')} onChange={e => set('companhia', e.target.value)} /></Field>
        <Field label="Número do voo"><Input placeholder="G3 1234" value={str('numero_voo')} onChange={e => set('numero_voo', e.target.value)} /></Field>
        <Field label="Sentido" required>
          <Select value={str('sentido')} onValueChange={v => set('sentido', v)}>
            <SelectTrigger><SelectValue placeholder="Ida ou volta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ida">Ida</SelectItem>
              <SelectItem value="volta">Volta</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Localizador (web check-in)"><Input value={str('localizador')} onChange={e => set('localizador', e.target.value)} /></Field>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <AirportCodeField label="Origem" required placeholder="FLN" value={str('origem')} onChange={v => set('origem', v)} />
        <AirportCodeField label="Destino" required placeholder="CUN" value={str('destino')} onChange={v => set('destino', v)} />
        <AirportCodeField label="Conexão — aeroporto/cidade" placeholder="GRU" value={str('conexao_local')} onChange={v => set('conexao_local', v)} />
        <Field label="Conexão — tempo de espera"><Input placeholder="2h35" value={str('conexao_duracao')} onChange={e => set('conexao_duracao', e.target.value)} /></Field>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <DateTimeField
          label="Partida (data e hora)" required
          date={str('data')} time={str('hora_embarque')}
          onChange={(d, t) => setMany({ data: d, hora_embarque: t })}
        />
        <DateTimeField
          label="Chegada (data e hora)"
          date={str('data_chegada')} time={str('hora_chegada')}
          onChange={(d, t) => setMany({ data_chegada: d, hora_chegada: t })}
        />
        <Field label="Categoria">
          <Select value={str('categoria') || 'none'} onValueChange={v => set('categoria', v === 'none' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Não informado</SelectItem>
              {CABIN_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Classe"><Input placeholder="Y" maxLength={2} value={str('classe')} onChange={e => set('classe', e.target.value.toUpperCase())} /></Field>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-40 shrink-0"><Field label="Nº do bilhete"><Input value={str('bilhete')} onChange={e => set('bilhete', e.target.value)} /></Field></div>
        <Field label="Franquia de bagagem"><BaggagePicker value={data.bagagem} onChange={b => set('bagagem', b)} /></Field>
      </div>

      <Field label="Observação">
        <Textarea rows={2} className="text-xs" value={str('observacoes')} onChange={e => set('observacoes', e.target.value)} />
      </Field>
    </>
  )
}

/** Formulário do produto "Hospedagem" — mesmo agrupamento do bloco
 *  Hospedagens de Cotações (QuotationEditorLodgingsBlock.tsx): hotel +
 *  localizador, depois check-in/check-out em grid de 4, tipo de
 *  quarto/regime, contato e por fim as observações em texto. */
export function HospedagemFormFields({ data, set }: { data: Record<string, string>; set: ProductFieldSetter }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Hotel"><Input placeholder="Nome do hotel/resort" value={data.hotel || ''} onChange={e => set('hotel', e.target.value)} /></Field>
        <Field label="Localizador (RES...)"><Input value={data.localizador || ''} onChange={e => set('localizador', e.target.value)} /></Field>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Field label="Check-in"><Input type="date" value={data.check_in || ''} onChange={e => set('check_in', e.target.value)} /></Field>
        <Field label="Horário do check-in"><Input type="time" value={data.hora_checkin || '15:00'} onChange={e => set('hora_checkin', e.target.value)} /></Field>
        <Field label="Check-out"><Input type="date" value={data.check_out || ''} onChange={e => set('check_out', e.target.value)} /></Field>
        <Field label="Horário do check-out"><Input type="time" value={data.hora_checkout || '12:00'} onChange={e => set('hora_checkout', e.target.value)} /></Field>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <Field label="Tipo de quarto"><Input placeholder="Suíte · vista jardim" value={data.tipo_quarto || ''} onChange={e => set('tipo_quarto', e.target.value)} /></Field>
        <Field label="Regime">
          <Select value={data.regime || 'none'} onValueChange={v => set('regime', v === 'none' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Não informado</SelectItem>
              {BOARD_OPTIONS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Titular da reserva"><Input value={data.titular || ''} onChange={e => set('titular', e.target.value)} /></Field>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <Field label="Endereço do hotel"><Input value={data.endereco || ''} onChange={e => set('endereco', e.target.value)} /></Field>
        <Field label="Telefone do hotel"><Input value={data.telefone || ''} onChange={e => set('telefone', e.target.value)} /></Field>
        <Field label="E-mail do hotel"><Input value={data.email || ''} onChange={e => set('email', e.target.value)} /></Field>
      </div>

      <Field label="Informações adicionais">
        <Textarea rows={2} className="text-xs" value={data.informacoes_adicionais || ''} onChange={e => set('informacoes_adicionais', e.target.value)} />
      </Field>
      <Field label="Política de cancelamento">
        <Textarea rows={2} className="text-xs" value={data.politica_cancelamento || ''} onChange={e => set('politica_cancelamento', e.target.value)} />
      </Field>
      <Field label="Condições da reserva">
        <Textarea rows={2} className="text-xs" value={data.condicoes || ''} onChange={e => set('condicoes', e.target.value)} />
      </Field>
    </>
  )
}
