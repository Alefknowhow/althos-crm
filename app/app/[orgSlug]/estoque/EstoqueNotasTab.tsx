'use client'

/**
 * "Notas fiscais" tab (invoice list + XML import dialog) for
 * EstoqueClient. Split out of EstoqueClient.tsx.
 */

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Upload } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  parseClinicSupplyInvoiceXml, createClinicSupplyInvoice,
  type ClinicSupplyRow, type ClinicSupplyInvoiceRow,
  type NfeReviewResult, type NfeReviewItem,
} from '@/actions/clinic-estoque'

function formatDateBR(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

export function NotasTab({ orgSlug, initialInvoices, supplies, onChanged }: {
  orgSlug: string
  initialInvoices: ClinicSupplyInvoiceRow[]
  supplies: ClinicSupplyRow[]
  onChanged: () => void
}) {
  const [search, setSearch] = useState('')
  const [importOpen, setImportOpen] = useState(false)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return initialInvoices
    return initialInvoices.filter(i => (i.nf_number || '').toLowerCase().includes(term) || (i.supplier_name || '').toLowerCase().includes(term))
  }, [initialInvoices, search])

  const methodLabel: Record<string, string> = { xml: 'XML', ocr: 'OCR', manual: 'Manual' }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input placeholder="Buscar por Nº NF ou fornecedor..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        <div className="flex-1" />
        <Button size="sm" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4 mr-1" /> Importar NF</Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Data emissão</th>
              <th className="text-left font-medium px-3 py-2">Nº NF</th>
              <th className="text-left font-medium px-3 py-2">Fornecedor</th>
              <th className="text-right font-medium px-3 py-2">Valor total</th>
              <th className="text-left font-medium px-3 py-2">Itens</th>
              <th className="text-left font-medium px-3 py-2">Importação</th>
              <th className="text-left font-medium px-3 py-2">Financeiro</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(i => (
              <tr key={i.id} className="border-t">
                <td className="px-3 py-2">{formatDateBR(i.issued_at)}</td>
                <td className="px-3 py-2 font-medium">{i.nf_number || '—'}</td>
                <td className="px-3 py-2">{i.supplier_name || '—'}</td>
                <td className="px-3 py-2 text-right">{i.total_cents != null ? formatCurrency(i.total_cents) : '—'}</td>
                <td className="px-3 py-2">{i.item_count}</td>
                <td className="px-3 py-2"><Badge variant="outline">{methodLabel[i.import_method] || i.import_method}</Badge></td>
                <td className="px-3 py-2">
                  {i.financial_entry_id
                    ? <Badge variant="outline" className="border-emerald-400 text-emerald-600">Lançado</Badge>
                    : <span className="text-muted-foreground text-xs">—</span>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Nenhuma NF importada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ImportInvoiceDialog orgSlug={orgSlug} open={importOpen} onOpenChange={setImportOpen} supplies={supplies} onSaved={onChanged} />
    </div>
  )
}

function ImportInvoiceDialog({ orgSlug, open, onOpenChange, supplies, onSaved }: {
  orgSlug: string
  open: boolean
  onOpenChange: (v: boolean) => void
  supplies: ClinicSupplyRow[]
  onSaved: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [review, setReview] = useState<NfeReviewResult | null>(null)
  const [manual, setManual] = useState({ nf_number: '', supplier_name: '', issued_at: '', total_cents: '' })

  function reset() {
    setReview(null)
    setManual({ nf_number: '', supplier_name: '', issued_at: '', total_cents: '' })
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const content = String(reader.result || '')
      startTransition(async () => {
        const res = await parseClinicSupplyInvoiceXml(orgSlug, content)
        if (res.ok) {
          setReview(res.data)
          setManual({
            nf_number: res.data.nf_number || '',
            supplier_name: res.data.supplier_name || '',
            issued_at: res.data.issued_at || '',
            total_cents: res.data.total_cents != null ? String(res.data.total_cents / 100) : '',
          })
        } else toast.error(res.error)
      })
    }
    reader.readAsText(file)
  }

  function updateItem(idx: number, patch: Partial<NfeReviewItem>) {
    setReview(r => r ? { ...r, items: r.items.map((it, i) => i === idx ? { ...it, ...patch } : it) } : r)
  }

  function handleConfirm() {
    if (!review) return
    startTransition(async () => {
      const res = await createClinicSupplyInvoice(orgSlug, {
        nf_number: manual.nf_number || null,
        supplier_name: manual.supplier_name || null,
        issued_at: manual.issued_at || null,
        total_cents: manual.total_cents ? Math.round(Number(manual.total_cents) * 100) : null,
        import_method: 'xml',
        items: review.items.map(it => ({
          supply_id: it.matched_supply_id,
          description_raw: it.description_raw,
          quantity: it.quantity,
          unit_cost_cents: it.unit_cost_cents,
          total_cost_cents: it.total_cost_cents,
          create_new_supply: it.matched_supply_id ? null : { name: it.description_raw, unit: 'un' },
        })),
      })
      if (res.ok) {
        toast.success('NF importada e estoque atualizado')
        onOpenChange(false)
        reset()
        onSaved()
      } else toast.error(res.error)
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar nota fiscal</DialogTitle>
        </DialogHeader>

        {!review && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Selecione o arquivo XML da NF-e. Os itens serão associados automaticamente aos insumos já cadastrados quando o nome bater — revise antes de confirmar.</p>
            <Input type="file" accept=".xml,text/xml" onChange={handleFile} disabled={isPending} />
          </div>
        )}

        {review && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Nº NF</Label>
                <Input value={manual.nf_number} onChange={e => setManual(m => ({ ...m, nf_number: e.target.value }))} />
              </div>
              <div>
                <Label>Fornecedor</Label>
                <Input value={manual.supplier_name} onChange={e => setManual(m => ({ ...m, supplier_name: e.target.value }))} />
              </div>
              <div>
                <Label>Data emissão</Label>
                <Input type="date" value={manual.issued_at} onChange={e => setManual(m => ({ ...m, issued_at: e.target.value }))} />
              </div>
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Descrição (XML)</th>
                    <th className="text-right font-medium px-3 py-2">Qtd</th>
                    <th className="text-right font-medium px-3 py-2">Valor unit.</th>
                    <th className="text-left font-medium px-3 py-2">Insumo no catálogo</th>
                  </tr>
                </thead>
                <tbody>
                  {review.items.map((it, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2">{it.description_raw}</td>
                      <td className="px-3 py-2 text-right">{it.quantity}</td>
                      <td className="px-3 py-2 text-right">{it.unit_cost_cents != null ? formatCurrency(it.unit_cost_cents) : '—'}</td>
                      <td className="px-3 py-2">
                        <select
                          className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                          value={it.matched_supply_id || ''}
                          onChange={e => {
                            const supplyId = e.target.value || null
                            const match = supplies.find(s => s.id === supplyId)
                            updateItem(idx, { matched_supply_id: supplyId, matched_supply_name: match?.name || null })
                          }}
                        >
                          <option value="">+ Criar novo insumo "{it.description_raw}"</option>
                          {supplies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          {review && <Button onClick={handleConfirm} disabled={isPending}>Confirmar e atualizar estoque</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
