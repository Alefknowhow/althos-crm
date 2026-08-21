'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
import { closeDeal, cancelDeal, type PropertyDealRow } from '@/actions/property-deals'
import type { PropertyProposalRow } from '@/actions/property-proposals'

type PropertyOption = { id: string; title: string; code: string | null }
type ContatoOption = { id: string; name: string }
type Member = { user_id: string; name: string }

function centsToStr(c?: number | null) { return c ? (c / 100).toFixed(2).replace('.', ',') : '' }
function strToCents(s: string) {
  const n = parseFloat((s || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
}
function fmtDate(d: string) { return new Date(d).toLocaleDateString('pt-BR') }

export default function PropertyDealsView({
  orgSlug, deals, properties, contatos, members = [], proposals = [], fixedPropertyId,
}: {
  orgSlug: string
  deals: PropertyDealRow[]
  properties: PropertyOption[]
  contatos: ContatoOption[]
  members?: Member[]
  proposals?: PropertyProposalRow[]
  fixedPropertyId?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [proposalId, setProposalId] = useState('')
  const [propertyId, setPropertyId] = useState(fixedPropertyId || '')
  const [contatoId, setContatoId] = useState('')
  const [brokerId, setBrokerId] = useState('')
  const [dealType, setDealType] = useState<'venda' | 'locacao'>('venda')
  const [finalPrice, setFinalPrice] = useState('')
  const [commission, setCommission] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  function resetForm() {
    setProposalId(''); setPropertyId(fixedPropertyId || ''); setContatoId(''); setBrokerId('')
    setDealType('venda'); setFinalPrice(''); setCommission('')
  }

  function applyProposal(id: string) {
    setProposalId(id)
    const p = proposals.find(x => x.id === id)
    // Proposta pode ter vários imóveis (Fase 8) — negócio fecha sempre em
    // UM imóvel específico, então usa o primeiro item como ponto de partida
    // (o usuário pode trocar o Select de imóvel antes de fechar).
    const firstItem = p?.items?.[0]
    if (p && firstItem) {
      setPropertyId(firstItem.propertyId); setContatoId(p.contato_id); setDealType(p.operation_type)
      if (firstItem.priceCents) setFinalPrice(centsToStr(firstItem.priceCents))
    }
  }

  async function handleClose() {
    if (!propertyId || !contatoId || !finalPrice) { toast.error('Preencha imóvel, lead e valor final.'); return }
    setSaving(true)
    const res = await closeDeal(orgSlug, {
      propertyId, contatoId, proposalId: proposalId || null, brokerUserId: brokerId || null,
      dealType, finalPriceCents: strToCents(finalPrice), commissionCents: strToCents(commission),
    })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Negócio fechado')
    setOpen(false); resetForm()
    router.refresh()
  }

  async function handleCancel(id: string) {
    if (!window.confirm('Cancelar este negócio? O imóvel volta a ficar disponível.')) return
    setBusyId(id)
    const res = await cancelDeal(orgSlug, id)
    setBusyId(null)
    if (!res.ok) { toast.error(res.error); return }
    router.refresh()
  }

  return (
    <div className={fixedPropertyId ? '' : 'p-4 sm:p-6 space-y-4'}>
      {!fixedPropertyId && (
        <PageHeader
          title="Negociações"
          hint="Negócios fechados — venda ou locação."
          actions={
            <Button onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Fechar negócio
            </Button>
          }
        />
      )}
      <div className="flex items-center justify-between gap-3">
        {!fixedPropertyId ? (
          <p className="text-sm text-muted-foreground">{deals.length} negócio{deals.length === 1 ? '' : 's'} fechado{deals.length === 1 ? '' : 's'}</p>
        ) : (
          <span />
        )}
        {fixedPropertyId && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Fechar negócio
          </Button>
        )}
      </div>

      <div className={fixedPropertyId ? 'border rounded-lg' : 'rounded-lg border bg-card'}>
        <Table>
          <TableHeader>
            <TableRow>
              {!fixedPropertyId && <TableHead>Imóvel</TableHead>}
              <TableHead>Lead</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Comissão</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Nenhum negócio fechado ainda.</TableCell></TableRow>
            )}
            {deals.map(d => (
              <TableRow key={d.id}>
                {!fixedPropertyId && (
                  <TableCell><Link href={`/app/${orgSlug}/imoveis/${d.property_id}`} className="hover:underline">{d.property_title || d.property_code || 'Imóvel'}</Link></TableCell>
                )}
                <TableCell className="text-sm">{d.contato_name || '—'}</TableCell>
                <TableCell className="text-sm">{d.deal_type === 'locacao' ? 'Locação' : 'Venda'}</TableCell>
                <TableCell className="text-sm tabular-nums">{formatCurrency(d.final_price_cents)}</TableCell>
                <TableCell className="text-sm tabular-nums">{d.commission_cents != null ? formatCurrency(d.commission_cents) : '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmtDate(d.closed_at)}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={d.status === 'aberto' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-muted text-muted-foreground hover:bg-muted'}>
                    {d.status === 'aberto' ? 'Fechado' : 'Cancelado'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {d.status === 'aberto' && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={busyId === d.id} onClick={() => handleCancel(d.id)}>
                      {busyId === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 text-destructive" />}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetForm() }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fechar negócio</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {proposals.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">A partir de uma proposta (opcional)</label>
                <Select value={proposalId || 'none'} onValueChange={v => v === 'none' ? resetForm() : applyProposal(v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma — preencher do zero</SelectItem>
                    {proposals.filter(p => p.status !== 'won' && p.status !== 'lost').map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.items.length > 1 ? `${p.items.length} imóveis` : (p.items[0]?.title || p.items[0]?.code || 'Imóvel')} — {p.contato_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!fixedPropertyId && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Imóvel</label>
                <Select value={propertyId} onValueChange={setPropertyId}>
                  <SelectTrigger><SelectValue placeholder="Escolher imóvel…" /></SelectTrigger>
                  <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.title || p.code || 'Imóvel'}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Lead (comprador/locatário)</label>
              <Select value={contatoId} onValueChange={setContatoId}>
                <SelectTrigger><SelectValue placeholder="Escolher lead…" /></SelectTrigger>
                <SelectContent>{contatos.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                <Select value={dealType} onValueChange={v => setDealType(v as 'venda' | 'locacao')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="venda">Venda</SelectItem>
                    <SelectItem value="locacao">Locação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Corretor</label>
                <Select value={brokerId || 'none'} onValueChange={v => setBrokerId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Sem corretor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem corretor</SelectItem>
                    {members.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Valor final (R$)</label>
                <Input inputMode="decimal" placeholder="0,00" value={finalPrice} onChange={e => setFinalPrice(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Comissão (R$)</label>
                <Input inputMode="decimal" placeholder="0,00" value={commission} onChange={e => setCommission(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleClose} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Fechar negócio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
