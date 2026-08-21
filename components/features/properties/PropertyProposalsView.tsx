'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileSignature, Plus, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { createProposal, setProposalStatus, type PropertyProposalRow, type PropertyProposalStatus } from '@/actions/property-proposals'

type PropertyOption = { id: string; title: string; code: string | null }
type ContatoOption = { id: string; name: string }

const STATUS_LABELS: Record<PropertyProposalStatus, string> = {
  draft: 'Rascunho', sent: 'Enviada', viewed: 'Vista', won: 'Aceita', lost: 'Recusada', expired: 'Expirada',
}
const STATUS_COLORS: Record<PropertyProposalStatus, string> = {
  draft: 'bg-muted text-muted-foreground hover:bg-muted',
  sent: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  viewed: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  won: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  lost: 'bg-red-100 text-red-700 hover:bg-red-100',
  expired: 'bg-muted text-muted-foreground hover:bg-muted',
}
const STATUS_ORDER: PropertyProposalStatus[] = ['draft', 'sent', 'viewed', 'won', 'lost', 'expired']

function strToCents(s: string) {
  const n = parseFloat((s || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
}

export default function PropertyProposalsView({
  orgSlug, proposals, properties, contatos, fixedPropertyId,
}: {
  orgSlug: string
  proposals: PropertyProposalRow[]
  properties: PropertyOption[]
  contatos: ContatoOption[]
  /** Quando embutido no detalhe do imóvel, trava o Select de imóvel. */
  fixedPropertyId?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [propertyId, setPropertyId] = useState(fixedPropertyId || '')
  const [contatoId, setContatoId] = useState('')
  const [operationType, setOperationType] = useState<'venda' | 'locacao'>('venda')
  const [offeredPrice, setOfferedPrice] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [conditions, setConditions] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  function resetForm() {
    setPropertyId(fixedPropertyId || ''); setContatoId(''); setOperationType('venda')
    setOfferedPrice(''); setValidUntil(''); setConditions('')
  }

  async function handleCreate() {
    if (!propertyId || !contatoId) { toast.error('Escolha o imóvel e o lead.'); return }
    setSaving(true)
    const res = await createProposal(orgSlug, {
      propertyId, contatoId, operationType,
      offeredPriceCents: strToCents(offeredPrice), validUntil: validUntil || null, conditions: conditions || null,
    })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Proposta criada')
    setOpen(false); resetForm()
    router.refresh()
  }

  async function handleStatus(id: string, status: PropertyProposalStatus) {
    setBusyId(id)
    const res = await setProposalStatus(orgSlug, id, status)
    setBusyId(null)
    if (!res.ok) { toast.error(res.error); return }
    router.refresh()
  }

  return (
    <div className={fixedPropertyId ? '' : 'p-4 sm:p-6 space-y-4'}>
      <div className="flex items-center justify-between gap-3">
        {!fixedPropertyId && (
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2"><FileSignature className="w-5 h-5" /> Propostas</h1>
            <p className="text-sm text-muted-foreground">{proposals.length} proposta{proposals.length === 1 ? '' : 's'}</p>
          </div>
        )}
        <Button size={fixedPropertyId ? 'sm' : 'default'} variant={fixedPropertyId ? 'outline' : 'default'} onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Nova proposta
        </Button>
      </div>

      <div className={fixedPropertyId ? 'border rounded-lg' : 'rounded-lg border bg-card'}>
        <Table>
          <TableHeader>
            <TableRow>
              {!fixedPropertyId && <TableHead>Imóvel</TableHead>}
              <TableHead>Lead</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor ofertado</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proposals.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Nenhuma proposta ainda.</TableCell></TableRow>
            )}
            {proposals.map(p => (
              <TableRow key={p.id}>
                {!fixedPropertyId && (
                  <TableCell>
                    <Link href={`/app/${orgSlug}/imoveis/${p.property_id}`} className="hover:underline">{p.property_title || p.property_code || 'Imóvel'}</Link>
                  </TableCell>
                )}
                <TableCell className="text-sm">{p.contato_name || '—'}</TableCell>
                <TableCell className="text-sm">{p.operation_type === 'locacao' ? 'Locação' : 'Venda'}</TableCell>
                <TableCell className="text-sm tabular-nums">{p.offered_price_cents != null ? formatCurrency(p.offered_price_cents) : '—'}</TableCell>
                <TableCell className="text-sm">{p.valid_until ? new Date(p.valid_until + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                <TableCell>
                  <Select value={p.status} onValueChange={v => handleStatus(p.id, v as PropertyProposalStatus)} disabled={busyId === p.id}>
                    <SelectTrigger className="w-[130px] h-7 text-xs border-0 p-0 [&>span]:inline-block">
                      <Badge className={STATUS_COLORS[p.status]} variant="secondary"><SelectValue /></Badge>
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
        <DialogContent>
          <DialogHeader><DialogTitle>Nova proposta</DialogTitle></DialogHeader>
          <div className="space-y-3">
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
              <label className="text-xs font-medium text-muted-foreground">Lead</label>
              <Select value={contatoId} onValueChange={setContatoId}>
                <SelectTrigger><SelectValue placeholder="Escolher lead…" /></SelectTrigger>
                <SelectContent>{contatos.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                <Select value={operationType} onValueChange={v => setOperationType(v as 'venda' | 'locacao')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="venda">Venda</SelectItem>
                    <SelectItem value="locacao">Locação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Valor ofertado (R$)</label>
                <Input inputMode="decimal" placeholder="0,00" value={offeredPrice} onChange={e => setOfferedPrice(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Válida até</label>
              <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="w-48" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Condições</label>
              <Textarea rows={3} value={conditions} onChange={e => setConditions(e.target.value)} placeholder="Forma de pagamento, prazo…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Criar proposta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
