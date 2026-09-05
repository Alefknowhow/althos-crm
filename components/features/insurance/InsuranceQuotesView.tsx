'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import {
  createQuote, setQuoteStatus,
  type InsuranceQuoteRow, type InsuranceQuoteStatus,
} from '@/actions/insurance-quotes'
import type { InsuranceProductRow } from '@/actions/insurance-products'
import type { InsurerRow } from '@/actions/insurers'

type ContatoOption = { id: string; name: string }

const STATUS_LABELS: Record<InsuranceQuoteStatus, string> = {
  rascunho: 'Rascunho', em_cotacao: 'Em cotação', recebida: 'Recebida', em_analise: 'Em análise',
  apresentada: 'Apresentada', em_negociacao: 'Em negociação', aprovada: 'Aprovada',
  recusada: 'Recusada', expirada: 'Expirada', cancelada: 'Cancelada',
}
const STATUS_COLORS: Record<InsuranceQuoteStatus, string> = {
  rascunho: 'bg-muted text-muted-foreground hover:bg-muted',
  em_cotacao: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  recebida: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  em_analise: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  apresentada: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  em_negociacao: 'bg-violet-100 text-violet-700 hover:bg-violet-100',
  aprovada: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  recusada: 'bg-red-100 text-red-700 hover:bg-red-100',
  expirada: 'bg-muted text-muted-foreground hover:bg-muted',
  cancelada: 'bg-muted text-muted-foreground hover:bg-muted',
}
const STATUS_ORDER: InsuranceQuoteStatus[] = [
  'rascunho', 'em_cotacao', 'recebida', 'em_analise', 'apresentada',
  'em_negociacao', 'aprovada', 'recusada', 'expirada', 'cancelada',
]

type ItemForm = { premium: string; coverage: string; franquia: string; conditions: string }

function strToCents(s: string) {
  const n = parseFloat((s || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
}

export default function InsuranceQuotesView({
  orgSlug, quotes, products, insurers, contatos,
}: {
  orgSlug: string
  quotes: InsuranceQuoteRow[]
  products: InsuranceProductRow[]
  insurers: InsurerRow[]
  contatos: ContatoOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [contatoId, setContatoId] = useState('')
  const [productId, setProductId] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [selected, setSelected] = useState<Record<string, ItemForm>>({})
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const activeInsurers = useMemo(() => insurers.filter(i => i.is_active), [insurers])
  const activeProducts = useMemo(() => products.filter(p => p.is_active), [products])

  function resetForm() {
    setContatoId(''); setProductId(''); setValidUntil(''); setNotes(''); setSelected({})
  }

  function toggleInsurer(id: string, checked: boolean) {
    setSelected(prev => {
      if (checked) return { ...prev, [id]: prev[id] ?? { premium: '', coverage: '', franquia: '', conditions: '' } }
      const { [id]: _omit, ...next } = prev
      return next
    })
  }

  function updateItem(id: string, patch: Partial<ItemForm>) {
    setSelected(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function handleCreate() {
    const items = Object.entries(selected).map(([insurerId, f]) => ({
      insurerId, premiumCents: strToCents(f.premium), coverage: f.coverage || null,
      franquia: f.franquia || null, conditions: f.conditions || null,
    }))
    if (items.length === 0 || !contatoId || !productId) { toast.error('Escolha o cliente, o produto e ao menos uma seguradora.'); return }
    setSaving(true)
    const res = await createQuote(orgSlug, { contatoId, insuranceProductId: productId, validUntil: validUntil || null, notes: notes || null, items })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Cotação criada')
    setOpen(false); resetForm()
    router.refresh()
  }

  async function handleStatus(id: string, status: InsuranceQuoteStatus) {
    setBusyId(id)
    const res = await setQuoteStatus(orgSlug, id, status)
    setBusyId(null)
    if (!res.ok) { toast.error(res.error); return }
    router.refresh()
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader
        title="Cotações"
        hint="Compare propostas de várias seguradoras para o mesmo cliente e produto."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Nova cotação
          </Button>
        }
      />
      <p className="text-sm text-muted-foreground">{quotes.length} cotaç{quotes.length === 1 ? 'ão' : 'ões'}</p>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Seguradoras</TableHead>
              <TableHead>Menor prêmio</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Nenhuma cotação ainda.</TableCell></TableRow>
            )}
            {quotes.map(q => (
              <TableRow key={q.id}>
                <TableCell className="text-sm">{q.contato_name || '—'}</TableCell>
                <TableCell className="text-sm">{q.product_name || '—'}</TableCell>
                <TableCell className="text-sm">{q.items.length}</TableCell>
                <TableCell className="text-sm tabular-nums">{q.lowestPremiumCents != null ? formatCurrency(q.lowestPremiumCents) : '—'}</TableCell>
                <TableCell>
                  <Select value={q.status} onValueChange={v => handleStatus(q.id, v as InsuranceQuoteStatus)} disabled={busyId === q.id}>
                    <SelectTrigger className="w-[150px] h-7 text-xs border-0 p-0 [&>span]:inline-block">
                      <Badge className={STATUS_COLORS[q.status]} variant="secondary"><SelectValue /></Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_ORDER.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetForm() }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova cotação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Cliente</label>
                <Select value={contatoId} onValueChange={setContatoId}>
                  <SelectTrigger><SelectValue placeholder="Escolher cliente…" /></SelectTrigger>
                  <SelectContent>{contatos.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Produto</label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger><SelectValue placeholder="Escolher produto…" /></SelectTrigger>
                  <SelectContent>{activeProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Seguradoras comparadas</label>
              <div className="border rounded-md divide-y max-h-80 overflow-y-auto">
                {activeInsurers.map(ins => {
                  const checked = ins.id in selected
                  const f = selected[ins.id]
                  return (
                    <div key={ins.id} className="p-2.5 space-y-2">
                      <div className="flex items-center gap-2.5">
                        <Checkbox checked={checked} onCheckedChange={v => toggleInsurer(ins.id, !!v)} />
                        <span className="text-sm font-medium flex-1">{ins.name}</span>
                      </div>
                      {checked && (
                        <div className="grid grid-cols-2 gap-2 pl-6">
                          <Input placeholder="Prêmio (R$)" inputMode="decimal" value={f.premium} onChange={e => updateItem(ins.id, { premium: e.target.value })} className="h-8 text-sm" />
                          <Input placeholder="Franquia" value={f.franquia} onChange={e => updateItem(ins.id, { franquia: e.target.value })} className="h-8 text-sm" />
                          <Input placeholder="Cobertura/limite" value={f.coverage} onChange={e => updateItem(ins.id, { coverage: e.target.value })} className="h-8 text-sm col-span-2" />
                          <Input placeholder="Condições/diferenciais" value={f.conditions} onChange={e => updateItem(ins.id, { conditions: e.target.value })} className="h-8 text-sm col-span-2" />
                        </div>
                      )}
                    </div>
                  )
                })}
                {activeInsurers.length === 0 && <p className="text-xs text-muted-foreground p-3 text-center">Cadastre seguradoras primeiro.</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Válida até</label>
                <Input type="date" className="w-40" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Observações</label>
              <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Necessidades do cliente, contexto…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Criar cotação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
