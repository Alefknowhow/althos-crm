'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Loader2, X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { issuePolicy, cancelPolicy, type InsurancePolicyRow, type InsurancePolicyStatus } from '@/actions/insurance-policies'
import type { InsuranceQuoteRow } from '@/actions/insurance-quotes'
import type { InsuranceProductRow } from '@/actions/insurance-products'
import type { InsurerRow } from '@/actions/insurers'

type ContatoOption = { id: string; name: string }

const STATUS_LABELS: Record<InsurancePolicyStatus, string> = {
  em_emissao: 'Em emissão', ativa: 'Ativa', suspensa: 'Suspensa', cancelada: 'Cancelada', expirada: 'Expirada',
}
const STATUS_COLORS: Record<InsurancePolicyStatus, string> = {
  em_emissao: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  ativa: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  suspensa: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  cancelada: 'bg-muted text-muted-foreground hover:bg-muted',
  expirada: 'bg-muted text-muted-foreground hover:bg-muted',
}

function centsToStr(c?: number | null) { return c ? (c / 100).toFixed(2).replace('.', ',') : '' }
function strToCents(s: string) {
  const n = parseFloat((s || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
}
function fmtDate(d: string) { return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') }

export default function InsurancePoliciesView({
  orgSlug, policies, quotes, products, insurers, contatos,
}: {
  orgSlug: string
  policies: InsurancePolicyRow[]
  quotes: InsuranceQuoteRow[]
  products: InsuranceProductRow[]
  insurers: InsurerRow[]
  contatos: ContatoOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [quoteId, setQuoteId] = useState('')
  const [contatoId, setContatoId] = useState('')
  const [productId, setProductId] = useState('')
  const [insurerId, setInsurerId] = useState('')
  const [premium, setPremium] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [installmentsCount, setInstallmentsCount] = useState('1')
  const [commission, setCommission] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const openQuotes = quotes.filter(q => q.status !== 'aprovada' && q.status !== 'recusada' && q.status !== 'cancelada')
  const selectedQuote = quotes.find(q => q.id === quoteId)

  function resetForm() {
    setQuoteId(''); setContatoId(''); setProductId(''); setInsurerId(''); setPremium('')
    setStartDate(''); setEndDate(''); setPaymentMethod(''); setInstallmentsCount('1'); setCommission('')
  }

  function applyQuote(id: string) {
    setQuoteId(id)
    const q = quotes.find(x => x.id === id)
    if (q) {
      setContatoId(q.contato_id); setProductId(q.insurance_product_id)
      setInsurerId(''); setPremium('')
    }
  }

  function applyQuoteInsurer(insurerIdChosen: string) {
    setInsurerId(insurerIdChosen)
    const item = selectedQuote?.items.find(it => it.insurerId === insurerIdChosen)
    if (item?.premiumCents) setPremium(centsToStr(item.premiumCents))
  }

  async function handleIssue() {
    if (!contatoId || !productId || !insurerId || !premium) { toast.error('Preencha cliente, produto, seguradora e prêmio.'); return }
    setSaving(true)
    const res = await issuePolicy(orgSlug, {
      quoteId: quoteId || null, contatoId, insuranceProductId: productId, insurerId,
      premiumCents: strToCents(premium), startDate: startDate || null, endDate: endDate || null,
      paymentMethod: paymentMethod || null, installmentsCount: parseInt(installmentsCount, 10) || 1,
      commissionCents: strToCents(commission),
    })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Apólice emitida')
    setOpen(false); resetForm()
    router.refresh()
  }

  async function handleCancel(id: string) {
    if (!window.confirm('Cancelar esta apólice? As parcelas de comissão pendentes também serão canceladas.')) return
    setBusyId(id)
    const res = await cancelPolicy(orgSlug, id)
    setBusyId(null)
    if (!res.ok) { toast.error(res.error); return }
    router.refresh()
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader
        title="Apólices"
        hint="Contratos de seguro emitidos."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Emitir apólice
          </Button>
        }
      />
      <p className="text-sm text-muted-foreground">{policies.length} apólice{policies.length === 1 ? '' : 's'}</p>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Seguradora</TableHead>
              <TableHead>Vigência</TableHead>
              <TableHead>Prêmio</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {policies.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Nenhuma apólice emitida ainda.</TableCell></TableRow>
            )}
            {policies.map(p => (
              <TableRow key={p.id}>
                <TableCell className="text-sm font-medium">{p.policy_number || '—'}</TableCell>
                <TableCell className="text-sm">{p.contato_name || '—'}</TableCell>
                <TableCell className="text-sm">{p.insurer_name || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {p.start_date ? fmtDate(p.start_date) : '—'}{p.end_date ? ` – ${fmtDate(p.end_date)}` : ''}
                </TableCell>
                <TableCell className="text-sm tabular-nums">{formatCurrency(p.premium_cents)}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={STATUS_COLORS[p.status]}>{STATUS_LABELS[p.status]}</Badge>
                </TableCell>
                <TableCell>
                  {p.status !== 'cancelada' && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={busyId === p.id} onClick={() => handleCancel(p.id)}>
                      {busyId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 text-destructive" />}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetForm() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Emitir apólice</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {openQuotes.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">A partir de uma cotação (opcional)</label>
                <Select value={quoteId || 'none'} onValueChange={v => v === 'none' ? resetForm() : applyQuote(v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma — preencher do zero</SelectItem>
                    {openQuotes.map(q => (
                      <SelectItem key={q.id} value={q.id}>{q.contato_name} — {q.product_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selectedQuote && selectedQuote.items.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Qual seguradora venceu?</label>
                <Select value={insurerId} onValueChange={applyQuoteInsurer}>
                  <SelectTrigger><SelectValue placeholder="Escolher seguradora…" /></SelectTrigger>
                  <SelectContent>
                    {selectedQuote.items.map(it => (
                      <SelectItem key={it.insurerId} value={it.insurerId}>
                        {it.insurerName} {it.premiumCents != null ? `— ${formatCurrency(it.premiumCents)}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!quoteId && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Cliente</label>
                  <Select value={contatoId} onValueChange={setContatoId}>
                    <SelectTrigger><SelectValue placeholder="Escolher cliente…" /></SelectTrigger>
                    <SelectContent>{contatos.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Produto</label>
                    <Select value={productId} onValueChange={setProductId}>
                      <SelectTrigger><SelectValue placeholder="Produto…" /></SelectTrigger>
                      <SelectContent>{products.filter(p => p.is_active).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Seguradora</label>
                    <Select value={insurerId} onValueChange={setInsurerId}>
                      <SelectTrigger><SelectValue placeholder="Seguradora…" /></SelectTrigger>
                      <SelectContent>{insurers.filter(i => i.is_active).map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Prêmio (R$)</label>
                <Input inputMode="decimal" placeholder="0,00" value={premium} onChange={e => setPremium(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Comissão (R$)</label>
                <Input inputMode="decimal" placeholder="0,00" value={commission} onChange={e => setCommission(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Início da vigência</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Fim da vigência</label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Forma de pagamento</label>
                <Input value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} placeholder="Boleto, cartão…" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Parcelas (comissão)</label>
                <Input type="number" min={1} max={48} value={installmentsCount} onChange={e => setInstallmentsCount(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleIssue} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Emitir apólice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
