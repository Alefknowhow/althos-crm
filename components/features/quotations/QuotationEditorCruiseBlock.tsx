'use client'

/**
 * Bloco "Cruzeiro" do grupo Produtos — extraído de
 * QuotationEditorProductsGroup.tsx (pura movimentação de JSX).
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2, Sparkles, Ship } from 'lucide-react'

import {
  nk, centsToStr, strToCents, SortableList, F, EditBlock, Disclosure,
} from './QuotationEditorFields'
import type { Cruise, QuotationTopState } from './QuotationEditorTypes'

export default function QuotationEditorCruiseBlock({
  q, cruises, setCruises, setCruiseOcrOpen,
}: {
  q: QuotationTopState
  cruises: Cruise[]; setCruises: React.Dispatch<React.SetStateAction<Cruise[]>>
  setCruiseOcrOpen: (v: boolean) => void
}) {
  return (
    <EditBlock id="blk-cruzeiro" icon={Ship} title="Cruzeiro"
      action={<div className="flex items-center gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={() => setCruiseOcrOpen(true)}>
          <Sparkles className="w-3.5 h-3.5 mr-1" /> Ler com IA
        </Button>
        <Button type="button" variant="outline" size="sm"
          onClick={() => setCruises(cs => [...cs, {
            _key: nk(), embark_date: q.start_date || null, disembark_date: q.end_date || null,
            pax_adults: q.pax_adults || null, pax_children: q.pax_children || null, days: [],
          }])}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Cruzeiro
        </Button>
      </div>}>
      {cruises.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cruzeiro nesta cotação.</p>}
      <SortableList items={cruises} onReorder={setCruises} render={(c) => (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium truncate">
              {c.ship_name || c.cruise_line || 'Cruzeiro sem nome'}
              {c.duration_nights ? ` · ${c.duration_nights} noites` : ''}
            </span>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 -mr-1 text-destructive hover:bg-destructive/10"
              title="Remover cruzeiro" onClick={() => setCruises(cs => cs.filter(x => x._key !== c._key))}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>

          {/* Essencial */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <F label="Companhia marítima"><Input placeholder="MSC Cruzeiros" value={c.cruise_line || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cruise_line: e.target.value } : x))} /></F>
            <F label="Navio"><Input placeholder="MSC Seaview" value={c.ship_name || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, ship_name: e.target.value } : x))} /></F>
            <F label="Roteiro"><Input placeholder="Caribe" value={c.itinerary_name || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, itinerary_name: e.target.value } : x))} /></F>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <F label="Embarque (data)"><Input type="date" value={c.embark_date || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, embark_date: e.target.value } : x))} /></F>
            <F label="Desembarque (data)"><Input type="date" value={c.disembark_date || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, disembark_date: e.target.value } : x))} /></F>
            <F label="Duração (noites)"><Input type="number" min={1} value={c.duration_nights ?? ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, duration_nights: e.target.value ? parseInt(e.target.value) : null } : x))} /></F>
            <F label="Cabine — Tipo de cabine"><Input placeholder="Balcony" value={c.cabin_category || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_category: e.target.value } : x))} /></F>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <F label="Porto de embarque"><Input placeholder="Miami" value={c.embark_port || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, embark_port: e.target.value } : x))} /></F>
            <F label="Porto de desembarque"><Input placeholder="Miami" value={c.disembark_port || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, disembark_port: e.target.value } : x))} /></F>
            <F label="Adultos"><Input type="number" min={0} value={c.pax_adults ?? ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, pax_adults: e.target.value ? parseInt(e.target.value) : null } : x))} /></F>
            <F label="Crianças"><Input type="number" min={0} value={c.pax_children ?? ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, pax_children: e.target.value ? parseInt(e.target.value) : null } : x))} /></F>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <F label="Valor da cabine (R$)"><Input inputMode="decimal" placeholder="0,00" defaultValue={centsToStr(c.cabin_price_cents)}
              onChange={e => { const v = strToCents(e.target.value); setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_price_cents: v, total_cents: (v || 0) + (x.taxes_cents || 0) } : x)) }} /></F>
            <F label="Taxas (R$)"><Input inputMode="decimal" placeholder="0,00" defaultValue={centsToStr(c.taxes_cents)}
              onChange={e => { const v = strToCents(e.target.value); setCruises(cs => cs.map(x => x._key === c._key ? { ...x, taxes_cents: v, total_cents: (x.cabin_price_cents || 0) + (v || 0) } : x)) }} /></F>
            <F label="Valor do produto (R$)" hint="taxas + valor da cabine">
              <Input disabled value={centsToStr((c.cabin_price_cents || 0) + (c.taxes_cents || 0))} />
            </F>
          </div>

          {/* Categoria/deck/localização/vista da cabine base — ficam
              acima de "Opções de cabine" por pedido explícito (eram
              antes recolhidos no Disclosure "Mais detalhes"). */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <F label="Categoria"><Input placeholder="Varanda" value={c.cabin_type || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_type: e.target.value } : x))} /></F>
            <F label="Deck"><Input placeholder="9" value={c.deck || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, deck: e.target.value } : x))} /></F>
            <F label="Localização"><Input placeholder="Meio do navio" value={c.location || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, location: e.target.value } : x))} /></F>
            <F label="Vista"><Input placeholder="Mar" value={c.view || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, view: e.target.value } : x))} /></F>
          </div>

          {/* Opções de cabine — cliente escolhe entre 2+ categorias. O
              valor de cada opção é o UPGRADE em relação à cabine base
              acima (0 pra base, positivo pras demais) — é isso que
              aparece no orçamento impresso/público como "+ R$X upgrade". */}
          <div className="border rounded-md p-2.5 bg-muted/30">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-muted-foreground">Opções de cabine (cliente escolhe)</p>
              <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] px-2"
                onClick={() => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_options: [...(x.cabin_options || []), { _key: nk(), label: '', price_cents: null }] } : x))}>
                <Plus className="w-3 h-3 mr-1" /> Opção
              </Button>
            </div>
            {(c.cabin_options || []).length === 0 && (
              <p className="text-[11px] text-muted-foreground">Nenhuma — a proposta usa só a cabine base acima.</p>
            )}
            {(c.cabin_options || []).length > 0 && (
              <div className="hidden sm:grid grid-cols-[1fr_90px_1fr_90px_110px_32px] gap-1.5 mb-1 px-0.5">
                <span className="text-[10px] text-muted-foreground">Tipo da cabine</span>
                <span className="text-[10px] text-muted-foreground">Deck</span>
                <span className="text-[10px] text-muted-foreground">Localização</span>
                <span className="text-[10px] text-muted-foreground">Vista</span>
                <span className="text-[10px] text-muted-foreground">Valor upgrade</span>
                <span />
              </div>
            )}
            {(c.cabin_options || []).map(opt => (
              <div key={opt._key} className="grid grid-cols-2 sm:grid-cols-[1fr_90px_1fr_90px_110px_32px] gap-1.5 mb-1.5 last:mb-0">
                <Input placeholder="Ex.: Cabine Balcony" value={opt.label}
                  onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_options: (x.cabin_options || []).map(o => o._key === opt._key ? { ...o, label: e.target.value } : o) } : x))} />
                <Input placeholder="Deck" value={opt.deck || ''}
                  onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_options: (x.cabin_options || []).map(o => o._key === opt._key ? { ...o, deck: e.target.value } : o) } : x))} />
                <Input placeholder="Localização" value={opt.location || ''}
                  onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_options: (x.cabin_options || []).map(o => o._key === opt._key ? { ...o, location: e.target.value } : o) } : x))} />
                <Input placeholder="Vista" value={opt.view || ''}
                  onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_options: (x.cabin_options || []).map(o => o._key === opt._key ? { ...o, view: e.target.value } : o) } : x))} />
                <Input inputMode="decimal" placeholder="0,00" defaultValue={centsToStr(opt.price_cents)}
                  onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_options: (x.cabin_options || []).map(o => o._key === opt._key ? { ...o, price_cents: strToCents(e.target.value) } : o) } : x))} />
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive"
                  onClick={() => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_options: (x.cabin_options || []).filter(o => o._key !== opt._key) } : x))}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {/* Recomendado */}
          <Disclosure label="Mais detalhes da cabine e pacotes">
            <label className="flex items-center gap-2 text-xs font-medium">
              <Switch checked={!!c.cabin_guaranteed} onCheckedChange={v => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_guaranteed: v } : x))} />
              Cabine garantida (número definido só no embarque)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <F label="Ocupação"><Input placeholder="2 adultos em cabine dupla" value={c.occupancy_label || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, occupancy_label: e.target.value } : x))} /></F>
              <F label="Desconto (R$)"><Input inputMode="decimal" placeholder="0,00" defaultValue={centsToStr(c.discount_cents)} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, discount_cents: strToCents(e.target.value) } : x))} /></F>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <F label="Pacote de bebidas"><Input placeholder="Easy Package" value={c.pkg_drinks || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, pkg_drinks: e.target.value } : x))} /></F>
              <F label="Valor upgrade bebidas (R$)"><Input inputMode="decimal" placeholder="0,00" defaultValue={centsToStr(c.pkg_drinks_upgrade_cents)} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, pkg_drinks_upgrade_cents: strToCents(e.target.value) } : x))} /></F>
              <F label="Internet"><Input placeholder="2 dispositivos" value={c.pkg_internet || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, pkg_internet: e.target.value } : x))} /></F>
              <F label="Restaurantes"><Input placeholder="Especialidade incluso" value={c.pkg_restaurants || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, pkg_restaurants: e.target.value } : x))} /></F>
              <F label="Gorjetas/taxa de serviço"><Input placeholder="Inclusas" value={c.pkg_gratuities || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, pkg_gratuities: e.target.value } : x))} /></F>
              <F label="Outros pacotes"><Input placeholder="Fotos, spa…" value={c.pkg_others || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, pkg_others: e.target.value } : x))} /></F>
              <F label="Adicionais (R$)"><Input inputMode="decimal" placeholder="0,00" defaultValue={centsToStr(c.extras_cents)} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, extras_cents: strToCents(e.target.value) } : x))} /></F>
            </div>

            {/* Itinerário por dia */}
            <F label="Itinerário (dia a dia)">
              <div className="space-y-1.5">
                {c.days.map((d, i) => (
                  <div key={d._key} className="grid grid-cols-[36px_1fr_1fr_70px_70px_28px] gap-1.5 items-center">
                    <Input type="number" min={1} className="text-center px-1" placeholder={`${i + 1}`} value={d.day_number ?? ''}
                      onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, days: x.days.map(y => y._key === d._key ? { ...y, day_number: e.target.value ? parseInt(e.target.value) : null } : y) } : x))} />
                    <Input placeholder="Porto/destino (ou 'Navegação')" value={d.port || ''}
                      onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, days: x.days.map(y => y._key === d._key ? { ...y, port: e.target.value } : y) } : x))} />
                    <Input type="date" value={d.date || ''}
                      onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, days: x.days.map(y => y._key === d._key ? { ...y, date: e.target.value } : y) } : x))} />
                    <Input placeholder="Chegada" value={d.arrival || ''}
                      onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, days: x.days.map(y => y._key === d._key ? { ...y, arrival: e.target.value } : y) } : x))} />
                    <Input placeholder="Saída" value={d.departure || ''}
                      onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, days: x.days.map(y => y._key === d._key ? { ...y, departure: e.target.value } : y) } : x))} />
                    <Button type="button" variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:bg-destructive/10"
                      onClick={() => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, days: x.days.filter(y => y._key !== d._key) } : x))}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, days: [...x.days, { _key: nk(), day_number: x.days.length + 1 }] } : x))}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Dia
                </Button>
              </div>
            </F>
          </Disclosure>

          {/* Avançado / interno — nunca aparece na proposta */}
          <Disclosure label="Informações avançadas (interno, não aparece na proposta)">
            <div className="grid grid-cols-2 gap-2">
              <F label="Fornecedor"><Input value={c.supplier || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, supplier: e.target.value } : x))} /></F>
              <F label="Código da tarifa"><Input value={c.fare_code || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, fare_code: e.target.value } : x))} /></F>
            </div>
            <F label="Custo (R$)"><Input inputMode="decimal" placeholder="0,00" defaultValue={centsToStr(c.cost_cents)} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cost_cents: strToCents(e.target.value) } : x))} /></F>
            <F label="Observações internas"><Textarea rows={2} value={c.internal_notes || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, internal_notes: e.target.value } : x))} /></F>
          </Disclosure>
        </>
      )} />
    </EditBlock>
  )
}
