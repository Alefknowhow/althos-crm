'use client'

/**
 * Detail-panel editor for a single budget document. Prop-driven, split
 * out of BudgetDocumentsView.tsx.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { getBudgetDocumentSourceUrl, type BudgetDocumentRow } from '@/actions/budget-documents'
import { FileStack, Trash2, ArrowLeft, Save, ExternalLink, Printer } from 'lucide-react'

export const STATUS_LABELS: Record<string, string> = { draft: 'Rascunho', sent: 'Enviado' }
export const STATUS_VARIANT: Record<string, 'warning' | 'success'> = { draft: 'warning', sent: 'success' }

function centsToReais(c?: number | null) { return c ? String((c / 100).toFixed(2)).replace('.', ',') : '' }
function reaisToCents(s: string) {
  const n = parseFloat((s || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

function MoneyInput({ value, onChange }: { value: number; onChange: (c: number) => void }) {
  const [text, setText] = useState(centsToReais(value))
  return (
    <Input inputMode="decimal" placeholder="R$ 0,00" value={text}
      onChange={e => { setText(e.target.value); onChange(reaisToCents(e.target.value)) }} />
  )
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>
}

export function BudgetEditor({
  orgSlug, doc, saving, onSave, onBack, onDelete,
}: {
  orgSlug: string
  doc: BudgetDocumentRow
  saving: boolean
  onSave: (patch: Record<string, any>) => void
  onBack: () => void
  onDelete: () => void
}) {
  const [d, setD] = useState<BudgetDocumentRow>(doc)
  const set = (k: keyof BudgetDocumentRow, v: any) => setD(prev => ({ ...prev, [k]: v }))
  const [includedText, setIncludedText] = useState((doc.included || []).join(', '))
  const [notIncludedText, setNotIncludedText] = useState((doc.not_included || []).join(', '))
  const [paymentText, setPaymentText] = useState((doc.payment_conditions || []).map(p => p.label).join('\n'))
  const [openingSource, setOpeningSource] = useState(false)

  const patch = () => ({
    contato_id: d.contato_id, client_name: d.client_name, destination: d.destination, hotel_name: d.hotel_name,
    start_date: d.start_date || null, end_date: d.end_date || null,
    pax_adults: d.pax_adults, pax_children: d.pax_children,
    included: includedText.split(',').map(s => s.trim()).filter(Boolean),
    not_included: notIncludedText.split(',').map(s => s.trim()).filter(Boolean),
    payment_conditions: paymentText.split('\n').map(s => s.trim()).filter(Boolean).map(label => ({ label, value: '' })),
    total_cents: d.total_cents, price_per_person_cents: d.price_per_person_cents,
    validity_days: d.validity_days, operadora: d.operadora, observacoes: d.observacoes, status: d.status,
  })

  async function handleOpenSource() {
    setOpeningSource(true)
    const res = await getBudgetDocumentSourceUrl(orgSlug, d.id)
    setOpeningSource(false)
    if (res.ok) window.open(res.url, '_blank', 'noopener,noreferrer')
    else toast.error(res.error)
  }

  return (
    <div className="flex flex-col w-full">
      <div className="sticky top-0 bg-card/90 border-b p-4 flex items-start gap-3 z-10">
        <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold truncate flex items-center gap-2">
            <FileStack className="w-4 h-4 text-primary shrink-0" /> {d.client_name || 'Orçamento'}
          </h2>
          <div className="mt-1.5"><Badge variant={STATUS_VARIANT[d.status]} className="text-[10px] px-1.5 py-0">{STATUS_LABELS[d.status]}</Badge></div>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {d.origem_arquivo && (
            <Button variant="outline" size="sm" disabled={openingSource} onClick={handleOpenSource} title="Ver arquivo original">
              <ExternalLink className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Original</span>
            </Button>
          )}
          <a href={`/app/${orgSlug}/cotacoes/${d.id}/orcamento`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" title="Gerar orçamento em PDF">
              <Printer className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Gerar PDF</span>
            </Button>
          </a>
          <Button variant="outline" size="sm" disabled={saving} onClick={() => onSave(patch())}>
            <Save className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">{saving ? 'Salvando…' : 'Salvar'}</span>
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={onDelete} aria-label="Excluir">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Cliente"><Input value={d.client_name || ''} onChange={e => set('client_name', e.target.value)} /></Field>
          <Field label="Destino"><Input value={d.destination || ''} onChange={e => set('destination', e.target.value)} /></Field>
          <Field label="Hotel"><Input value={d.hotel_name || ''} onChange={e => set('hotel_name', e.target.value)} /></Field>
          <Field label="Data de ida"><Input type="date" value={d.start_date || ''} onChange={e => set('start_date', e.target.value)} /></Field>
          <Field label="Data de volta"><Input type="date" value={d.end_date || ''} onChange={e => set('end_date', e.target.value)} /></Field>
          <Field label="Operadora"><Input value={d.operadora || ''} onChange={e => set('operadora', e.target.value)} /></Field>
          <Field label="Adultos"><Input type="number" min="0" value={d.pax_adults ?? ''} onChange={e => set('pax_adults', e.target.value ? parseInt(e.target.value) : null)} /></Field>
          <Field label="Crianças"><Input type="number" min="0" value={d.pax_children ?? ''} onChange={e => set('pax_children', e.target.value ? parseInt(e.target.value) : null)} /></Field>
          <Field label="Valor total"><MoneyInput value={d.total_cents || 0} onChange={c => set('total_cents', c)} /></Field>
          <Field label="Valor por pessoa"><MoneyInput value={d.price_per_person_cents || 0} onChange={c => set('price_per_person_cents', c)} /></Field>
          <Field label="Status">
            <Select value={d.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Incluso (separado por vírgula)">
          <Input value={includedText} onChange={e => setIncludedText(e.target.value)} placeholder="Café da manhã, Traslado, Seguro viagem" />
        </Field>
        <Field label="Não incluso (separado por vírgula)">
          <Input value={notIncludedText} onChange={e => setNotIncludedText(e.target.value)} placeholder="Passeios opcionais, Taxas de embarque" />
        </Field>
        <Field label="Condições de pagamento (uma por linha)">
          <Textarea rows={3} value={paymentText} onChange={e => setPaymentText(e.target.value)} placeholder={'Pix à vista com 5% de desconto\nCartão em até 10x sem juros'} />
        </Field>
        <Field label="Observações"><Textarea rows={2} value={d.observacoes || ''} onChange={e => set('observacoes', e.target.value)} /></Field>
      </div>
    </div>
  )
}
