'use client'

/**
 * "Itens" tab (supply catalog table + create/edit dialog) for
 * EstoqueClient. Split out of EstoqueClient.tsx.
 */

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  createClinicSupply, updateClinicSupply, deleteClinicSupply,
  type ClinicSupplyRow,
} from '@/actions/clinic-estoque'

function formatDateBR(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

export function ItensTab({ orgSlug, supplies, onChanged }: { orgSlug: string; supplies: ClinicSupplyRow[]; onChanged: () => void }) {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ClinicSupplyRow | null>(null)
  const [, startTransition] = useTransition()

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
              <th className="text-right font-medium px-3 py-2">Consumo médio/dia</th>
              <th className="text-right font-medium px-3 py-2">Duração</th>
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
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {s.avg_daily_consumption != null ? `${s.avg_daily_consumption.toFixed(2)} ${s.unit}/dia` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {s.duration_days != null ? (
                      <span className={s.duration_days <= 7 ? 'text-red-600 font-medium' : s.duration_days <= 15 ? 'text-amber-600 font-medium' : ''}>
                        {s.duration_days} {s.duration_days === 1 ? 'dia' : 'dias'}
                      </span>
                    ) : '—'}
                  </td>
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
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Nenhum insumo encontrado.</td></tr>
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
              <Input type="date" className="w-40" value={form.first_acquired_at} onChange={e => setForm(f => ({ ...f, first_acquired_at: e.target.value }))} />
            </div>
            <div>
              <Label>Última compra</Label>
              <Input type="date" className="w-40" value={form.last_purchase_at} onChange={e => setForm(f => ({ ...f, last_purchase_at: e.target.value }))} />
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
