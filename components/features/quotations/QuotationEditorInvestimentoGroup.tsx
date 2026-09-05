'use client'

/**
 * Grupo "Investimento" do editor de cotação — total, valor por pessoa,
 * opções de hospedagem alternativa, formas de pagamento e disclaimer.
 *
 * Extraído de QuotationEditor.tsx (pura movimentação de JSX, sem mudança de
 * comportamento) — recebe o estado relevante e os setters via props.
 */

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Wallet } from 'lucide-react'

import {
  PAYMENT_METHODS, centsToStr, strToCents,
  F, EditBlock, type GroupId, GroupSection,
} from './QuotationEditorFields'
import type { Lodging, QuotationTopState } from './QuotationEditorTypes'

export default function QuotationEditorInvestimentoGroup({
  activeGroup, q, setQ, paxTotal,
  lodgings, setLodgings,
  productBreakdown,
}: {
  activeGroup: GroupId
  q: QuotationTopState
  setQ: React.Dispatch<React.SetStateAction<QuotationTopState>>
  paxTotal: number
  lodgings: Lodging[]; setLodgings: React.Dispatch<React.SetStateAction<Lodging[]>>
  productBreakdown: { icon: string; label: string; price_cents: number | null }[]
}) {
  return (
    <GroupSection id="investimento" active={activeGroup}>
      {/* INVESTIMENTO */}
      <EditBlock id="blk-investimento" icon={Wallet} title="Investimento">
        {productBreakdown.length > 0 && (
          <div className="rounded-lg border bg-muted/20 p-2.5 space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Produtos da viagem</p>
            {productBreakdown.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate">{p.icon} {p.label}</span>
                <span className="tabular-nums shrink-0">{p.price_cents != null ? centsToStr(p.price_cents).replace(/^/, 'R$ ') : '—'}</span>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground pt-1 border-t">O total abaixo continua sendo o valor comercial final — pode diferir da soma dos produtos (descontos, arredondamento, etc.).</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <F label="Total (R$)">
            <Input inputMode="decimal" placeholder="17.800,00" defaultValue={centsToStr(q.total_cents)}
              onChange={e => setQ(s => ({ ...s, total_cents: strToCents(e.target.value) || 0 }))} />
          </F>
          <F label={`Valor por pessoa${paxTotal ? ` · ${paxTotal} pessoas` : ''}`} hint="calculado automaticamente">
            <Input inputMode="decimal" value={centsToStr(q.price_per_person_cents)} disabled />
          </F>
        </div>
        {lodgings.some(l => l.is_alternative_option) && (
          <F label="Opções de hospedagem alternativa" hint="preço de cada opção — aparece na Vitrine como cards separados">
            <div className="space-y-2">
              {lodgings.filter(l => l.is_alternative_option).map((l, i) => (
                <div key={l._key} className="rounded-lg border p-2.5 grid grid-cols-[1fr_1fr_1fr] gap-2 items-end">
                  <span className="text-xs font-medium text-muted-foreground truncate col-span-3 sm:col-span-1">
                    Opção {i + 1} · {l.name || 'sem nome'}
                  </span>
                  <F label="Por pessoa">
                    <Input placeholder="0,00" value={centsToStr(l.option_price_per_person_cents)}
                      onChange={e => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, option_price_per_person_cents: strToCents(e.target.value) } : x))} />
                  </F>
                  <F label="Total">
                    <Input placeholder="0,00" value={centsToStr(l.option_total_cents)}
                      onChange={e => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, option_total_cents: strToCents(e.target.value) } : x))} />
                  </F>
                </div>
              ))}
            </div>
          </F>
        )}
        <F label="Formas de pagamento">
          <div className="space-y-1.5">
            {PAYMENT_METHODS.map(m => {
              const active = q.payment_conditions.some(p => p.label === m.label)
              const cond = q.payment_conditions.find(p => p.label === m.label)
              const Icon = m.icon
              return (
                <div key={m.label} className="flex items-center gap-2">
                  <button type="button"
                    onClick={() => setQ(s => ({
                      ...s,
                      payment_conditions: active
                        ? s.payment_conditions.filter(p => p.label !== m.label)
                        : [...s.payment_conditions, { label: m.label, value: '' }],
                    }))}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-colors w-40 shrink-0 ${
                      active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-muted'
                    }`}>
                    <Icon className="w-4 h-4" /> {m.label}
                  </button>
                  {active && (
                    <Input className="flex-1" placeholder={m.placeholder} value={cond?.value || ''}
                      onChange={e => setQ(s => ({
                        ...s,
                        payment_conditions: s.payment_conditions.map(p => p.label === m.label ? { ...p, value: e.target.value } : p),
                      }))} />
                  )}
                </div>
              )
            })}
          </div>
        </F>
        <F label="Disclaimer"><Textarea rows={2} placeholder="Preços sujeitos a alteração sem aviso prévio…" value={q.price_disclaimer}
          onChange={e => setQ(s => ({ ...s, price_disclaimer: e.target.value }))} /></F>
        <div className="grid grid-cols-2 gap-3 border-t pt-3">
          <F label="Operadora (interno)"><Input value={q.operadora} onChange={e => setQ(s => ({ ...s, operadora: e.target.value }))} placeholder="Não aparece na proposta" /></F>
          <F label="Comissão total (interno)"><Input inputMode="decimal" defaultValue={centsToStr(q.commission_total_cents)}
            onChange={e => setQ(s => ({ ...s, commission_total_cents: strToCents(e.target.value) }))} /></F>
        </div>
      </EditBlock>
    </GroupSection>
  )
}
