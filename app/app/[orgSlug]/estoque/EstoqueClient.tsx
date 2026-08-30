'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, Package, AlertTriangle, TrendingDown, Boxes, Upload } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  createClinicSupply, updateClinicSupply, deleteClinicSupply, adjustClinicSupplyStock,
  parseClinicSupplyInvoiceXml, createClinicSupplyInvoice,
  type ClinicSupplyRow, type ClinicSupplyConsumptionRow, type ClinicSupplyInvoiceRow, type ClinicEstoqueKpis,
  type NfeReviewResult, type NfeReviewItem,
} from '@/actions/clinic-estoque'
import type { ClinicProfessional } from '@/actions/clinic'

function formatDateBR(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

function formatDateTimeBR(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function EstoqueClient({
  orgSlug, initialSupplies, initialConsumption, initialInvoices, initialKpis, professionals,
}: {
  orgSlug: string
  initialSupplies: ClinicSupplyRow[]
  initialConsumption: ClinicSupplyConsumptionRow[]
  initialInvoices: ClinicSupplyInvoiceRow[]
  initialKpis: ClinicEstoqueKpis
  professionals: ClinicProfessional[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <div className="space-y-6">
      <KpiBar kpis={initialKpis} />
      <Tabs defaultValue="itens">
        <TabsList>
          <TabsTrigger value="itens">Itens</TabsTrigger>
          <TabsTrigger value="consumo">Consumo</TabsTrigger>
          <TabsTrigger value="notas">Notas fiscais</TabsTrigger>
        </TabsList>
        <TabsContent value="itens" className="mt-4">
          <ItensTab orgSlug={orgSlug} supplies={initialSupplies} onChanged={() => router.refresh()} />
        </TabsContent>
        <TabsContent value="consumo" className="mt-4">
          <ConsumoTab orgSlug={orgSlug} initialConsumption={initialConsumption} professionals={professionals} />
        </TabsContent>
        <TabsContent value="notas" className="mt-4">
          <NotasTab orgSlug={orgSlug} initialInvoices={initialInvoices} supplies={initialSupplies} onChanged={() => router.refresh()} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

function KpiBar({ kpis }: { kpis: ClinicEstoqueKpis }) {
  const items = [
    { label: 'Valor total em estoque', value: formatCurrency(kpis.totalStockValueCents), icon: Package },
    { label: 'Itens cadastrados', value: String(kpis.itemCount), icon: Boxes },
    { label: 'Itens com estoque baixo', value: String(kpis.lowStockCount), icon: AlertTriangle, warn: kpis.lowStockCount > 0 },
    { label: 'Consumo no mês (valor)', value: formatCurrency(kpis.consumptionValueThisMonthCents), icon: TrendingDown },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(it => (
        <Card key={it.label} className={it.warn ? 'border-amber-400' : undefined}>
          <CardContent className="p-4 flex items-center gap-3">
            <it.icon className={`w-5 h-5 shrink-0 ${it.warn ? 'text-amber-500' : 'text-muted-foreground'}`} strokeWidth={1.75} />
            <div>
              <div className="text-xs text-muted-foreground">{it.label}</div>
              <div className="text-lg font-semibold">{it.value}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ── Itens ─────────────────────────────────────────────────────────────────────

function ItensTab({ orgSlug, supplies, onChanged }: { orgSlug: string; supplies: ClinicSupplyRow[]; onChanged: () => void }) {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ClinicSupplyRow | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return supplies
    return supplies.filter(s => s.name.toLowerCase().includes(term) || (s.supplier_name || '').toLowerCase().includes(term))
  }, [search, supplies])

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }
  function openEdit(s: ClinicSupplyRow) {
    setEditing(s)
    setDialogOpen(true)
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteClinicSupply(orgSlug, id)
      if (res.ok) { toast.success('Insumo excluído'); onChanged() } else toast.error(res.error)
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input placeholder="Buscar insumo ou fornecedor..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        <div className="flex-1" />
        <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Novo insumo</Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Nome</th>
              <th className="text-left font-medium px-3 py-2">Fornecedor</th>
              <th className="text-right font-medium px-3 py-2">Qtd. em estoque</th>
              <th className="text-right font-medium px-3 py-2">Valor unitário</th>
              <th className="text-right font-medium px-3 py-2">Valor em estoque</th>
              <th className="text-left font-medium px-3 py-2">Última compra</th>
              <th className="text-left font-medium px-3 py-2">Nº NF</th>
              <th className="text-right font-medium px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const low = s.min_stock_alert != null && s.quantity_in_stock <= s.min_stock_alert
              return (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2 font-medium">
                    {s.name}
                    {low && <Badge variant="outline" className="ml-2 border-amber-400 text-amber-600">Estoque baixo</Badge>}
                    {!s.active && <Badge variant="outline" className="ml-2">Inativo</Badge>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{s.supplier_name || '—'}</td>
                  <td className="px-3 py-2 text-right">{s.quantity_in_stock} {s.unit}</td>
                  <td className="px-3 py-2 text-right">{s.last_unit_cost_cents != null ? formatCurrency(s.last_unit_cost_cents) : '—'}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(s.stock_value_cents)}</td>
                  <td className="px-3 py-2">{formatDateBR(s.last_purchase_at)}</td>
                  <td className="px-3 py-2">{s.last_purchase_nf_number || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost"><Trash2 className="w-4 h-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir insumo</AlertDialogTitle>
                            <AlertDialogDescription>Isso remove "{s.name}" do catálogo. O backlog de consumo já registrado não é apagado.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(s.id)}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Nenhum insumo encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <SupplyDialog orgSlug={orgSlug} open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} onSaved={onChanged} />
    </div>
  )
}

function SupplyDialog({ orgSlug, open, onOpenChange, editing, onSaved }: {
  orgSlug: string
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: ClinicSupplyRow | null
  onSaved: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState(() => toFormState(editing))

  useMemo(() => { setForm(toFormState(editing)) }, [editing, open])

  function toFormState(s: ClinicSupplyRow | null) {
    return {
      name: s?.name || '',
      unit: s?.unit || 'un',
      supplier_name: s?.supplier_name || '',
      quantity_in_stock: s ? String(s.quantity_in_stock) : '0',
      min_stock_alert: s?.min_stock_alert != null ? String(s.min_stock_alert) : '',
      last_unit_cost: s?.last_unit_cost_cents != null ? String(s.last_unit_cost_cents / 100) : '',
      first_acquired_at: s?.first_acquired_at ? s.first_acquired_at.slice(0, 10) : '',
      last_purchase_at: s?.last_purchase_at ? s.last_purchase_at.slice(0, 10) : '',
      last_purchase_nf_number: s?.last_purchase_nf_number || '',
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const input = {
      name: form.name,
      unit: form.unit,
      supplier_name: form.supplier_name || null,
      quantity_in_stock: Number(form.quantity_in_stock) || 0,
      min_stock_alert: form.min_stock_alert ? Number(form.min_stock_alert) : null,
      last_unit_cost_cents: form.last_unit_cost ? Math.round(Number(form.last_unit_cost) * 100) : null,
      first_acquired_at: form.first_acquired_at || null,
      last_purchase_at: form.last_purchase_at || null,
      last_purchase_nf_number: form.last_purchase_nf_number || null,
    }
    startTransition(async () => {
      const res = editing ? await updateClinicSupply(orgSlug, editing.id, input) : await createClinicSupply(orgSlug, input)
      if (res.ok) {
        toast.success(editing ? 'Insumo atualizado' : 'Insumo criado')
        onOpenChange(false)
        onSaved()
      } else toast.error(res.error)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar insumo' : 'Novo insumo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <Label>Unidade</Label>
              <Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="un, ml, cx..." />
            </div>
            <div>
              <Label>Fornecedor</Label>
              <Input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} />
            </div>
            <div>
              <Label>Qtd. em estoque</Label>
              <Input type="number" step="0.001" value={form.quantity_in_stock} onChange={e => setForm(f => ({ ...f, quantity_in_stock: e.target.value }))} />
            </div>
            <div>
              <Label>Alerta de estoque mínimo</Label>
              <Input type="number" step="0.001" value={form.min_stock_alert} onChange={e => setForm(f => ({ ...f, min_stock_alert: e.target.value }))} />
            </div>
            <div>
              <Label>Valor por unidade (R$)</Label>
              <Input type="number" step="0.01" value={form.last_unit_cost} onChange={e => setForm(f => ({ ...f, last_unit_cost: e.target.value }))} />
            </div>
            <div>
              <Label>Data de aquisição</Label>
              <Input type="date" value={form.first_acquired_at} onChange={e => setForm(f => ({ ...f, first_acquired_at: e.target.value }))} />
            </div>
            <div>
              <Label>Última compra</Label>
              <Input type="date" value={form.last_purchase_at} onChange={e => setForm(f => ({ ...f, last_purchase_at: e.target.value }))} />
            </div>
            <div>
              <Label>Nº NF de entrada</Label>
              <Input value={form.last_purchase_nf_number} onChange={e => setForm(f => ({ ...f, last_purchase_nf_number: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>{editing ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Consumo (backlog) ────────────────────────────────────────────────────────

function ConsumoTab({ orgSlug, initialConsumption, professionals }: {
  orgSlug: string
  initialConsumption: ClinicSupplyConsumptionRow[]
  professionals: ClinicProfessional[]
}) {
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [professionalId, setProfessionalId] = useState('')

  const filtered = useMemo(() => {
    let rows = initialConsumption
    if (from) rows = rows.filter(r => r.consumed_at.slice(0, 10) >= from)
    if (to) rows = rows.filter(r => r.consumed_at.slice(0, 10) <= to)
    if (professionalId) rows = rows.filter(r => r.professional_id === professionalId)
    const term = search.trim().toLowerCase()
    if (term) rows = rows.filter(r =>
      r.supply_name.toLowerCase().includes(term) ||
      (r.professional_name || '').toLowerCase().includes(term) ||
      (r.patient_name || '').toLowerCase().includes(term)
    )
    return rows
  }, [initialConsumption, search, from, to, professionalId])

  const sourceLabel: Record<string, string> = { atendimento: 'Atendimento', manual: 'Manual', ajuste: 'Ajuste' }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label className="text-xs">Buscar</Label>
          <Input placeholder="Insumo, profissional, paciente..." value={search} onChange={e => setSearch(e.target.value)} className="w-64" />
        </div>
        <div>
          <Label className="text-xs">De</Label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Até</Label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Profissional</Label>
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={professionalId} onChange={e => setProfessionalId(e.target.value)}>
            <option value="">Todos</option>
            {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Data/hora</th>
              <th className="text-left font-medium px-3 py-2">Insumo</th>
              <th className="text-right font-medium px-3 py-2">Quantidade</th>
              <th className="text-left font-medium px-3 py-2">Profissional</th>
              <th className="text-left font-medium px-3 py-2">Paciente</th>
              <th className="text-left font-medium px-3 py-2">Origem</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{formatDateTimeBR(r.consumed_at)}</td>
                <td className="px-3 py-2 font-medium">{r.supply_name}</td>
                <td className="px-3 py-2 text-right">{r.quantity} {r.unit}</td>
                <td className="px-3 py-2">{r.professional_name || '—'}</td>
                <td className="px-3 py-2">{r.patient_name || '—'}</td>
                <td className="px-3 py-2"><Badge variant="outline">{sourceLabel[r.source] || r.source}</Badge></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Nenhum consumo encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Notas fiscais ─────────────────────────────────────────────────────────────

function NotasTab({ orgSlug, initialInvoices, supplies, onChanged }: {
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
