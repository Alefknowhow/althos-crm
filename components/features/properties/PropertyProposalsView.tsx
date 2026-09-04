'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Loader2, Link2, Copy } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import {
  createProposal, setProposalStatus, generatePropertyProposalLink,
  type PropertyProposalRow, type PropertyProposalStatus,
} from '@/actions/property-proposals'

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
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0
}
export default function PropertyProposalsView({
  orgSlug, proposals, properties, contatos, fixedPropertyId, preselectedPropertyIds, preselectedContatoId, onDialogClose,
}: {
  orgSlug: string
  proposals: PropertyProposalRow[]
  properties: PropertyOption[]
  contatos: ContatoOption[]
  /** Quando embutido no detalhe do imóvel, trava a seleção nesse imóvel só. */
  fixedPropertyId?: string
  /** Pré-marca esses imóveis ao abrir o dialog (vindo de "Criar proposta com selecionados" nas sugestões de IA, via /propostas?preselect=...). */
  preselectedPropertyIds?: string[]
  /** Pré-marca o lead ao abrir o dialog junto com preselectedPropertyIds. */
  preselectedContatoId?: string
  /** Avisa o componente pai quando o dialog fecha, pra limpar a seleção externa. */
  onDialogClose?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Record<string, string>>({}) // propertyId -> priceStr
  const [contatoId, setContatoId] = useState('')
  const [operationType, setOperationType] = useState<'venda' | 'locacao'>('venda')
  const [validUntil, setValidUntil] = useState('')
  const [conditions, setConditions] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null)

  const filteredProperties = useMemo(() => {
    if (!search.trim()) return properties
    const needle = search.trim().toLowerCase()
    return properties.filter(p => [p.title, p.code].filter(Boolean).join(' ').toLowerCase().includes(needle))
  }, [properties, search])

  const totalCents = Object.values(selected).reduce((a, s) => a + strToCents(s), 0)

  // Abre sozinho quando o pai (ex. PropertyMatchSuggestions) manda uma nova
  // seleção de sugestões de IA pra virar proposta.
  useEffect(() => {
    if (preselectedPropertyIds && preselectedPropertyIds.length > 0) {
      openDialog(preselectedPropertyIds)
      if (preselectedContatoId) setContatoId(preselectedContatoId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedPropertyIds, preselectedContatoId])

  function openDialog(withPreselected?: string[]) {
    const initial: Record<string, string> = {}
    const ids = fixedPropertyId ? [fixedPropertyId] : (withPreselected || preselectedPropertyIds || [])
    for (const id of ids) initial[id] = ''
    setSelected(initial)
    setOpen(true)
  }

  function toggleProperty(id: string, checked: boolean) {
    setSelected(prev => {
      if (checked) return { ...prev, [id]: prev[id] ?? '' }
      const { [id]: _omit, ...next } = prev
      return next
    })
  }

  function resetForm() {
    setSelected({}); setContatoId(''); setOperationType('venda')
    setValidUntil(''); setConditions(''); setSearch('')
  }

  async function handleCreate() {
    const items = Object.entries(selected).map(([propertyId, priceStr]) => ({ propertyId, priceCents: strToCents(priceStr) }))
    if (items.length === 0 || !contatoId) { toast.error('Escolha ao menos um imóvel e o lead.'); return }
    setSaving(true)
    const res = await createProposal(orgSlug, {
      items, contatoId, operationType, validUntil: validUntil || null, conditions: conditions || null,
    })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Proposta criada')
    setOpen(false); resetForm()
    onDialogClose?.()
    router.refresh()
  }

  async function handleStatus(id: string, status: PropertyProposalStatus) {
    setBusyId(id)
    const res = await setProposalStatus(orgSlug, id, status)
    setBusyId(null)
    if (!res.ok) { toast.error(res.error); return }
    router.refresh()
  }

  async function handleLink(id: string, hasToken: boolean) {
    if (hasToken) {
      const p = proposals.find(x => x.id === id)
      if (p?.public_token) {
        await navigator.clipboard.writeText(`${window.location.origin}/imoveis-proposta/${p.public_token}`)
        toast.success('Link copiado')
      }
      return
    }
    setLinkBusyId(id)
    const res = await generatePropertyProposalLink(orgSlug, id)
    setLinkBusyId(null)
    if (!res.ok) { toast.error(res.error); return }
    await navigator.clipboard.writeText(`${window.location.origin}/imoveis-proposta/${res.token}`)
    toast.success('Link gerado e copiado')
    router.refresh()
  }

  return (
    <div className={fixedPropertyId ? '' : 'p-4 sm:p-6 space-y-4'}>
      {!fixedPropertyId && (
        <PageHeader
          title="Propostas"
          hint="Propostas de compra ou locação feitas a leads — um ou mais imóveis por proposta, com link público."
          actions={
            <Button onClick={() => openDialog()}>
              <Plus className="w-4 h-4 mr-1.5" /> Nova proposta
            </Button>
          }
        />
      )}
      <div className="flex items-center justify-between gap-3">
        {!fixedPropertyId ? (
          <p className="text-sm text-muted-foreground">{proposals.length} proposta{proposals.length === 1 ? '' : 's'}</p>
        ) : (
          <span />
        )}
        {fixedPropertyId && (
          <Button size="sm" variant="outline" onClick={() => openDialog()}>
            <Plus className="w-4 h-4 mr-1.5" /> Nova proposta
          </Button>
        )}
      </div>

      <div className={fixedPropertyId ? 'border rounded-lg' : 'rounded-lg border bg-card'}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Imóveis</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor total</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {proposals.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Nenhuma proposta ainda.</TableCell></TableRow>
            )}
            {proposals.map(p => (
              <TableRow key={p.id}>
                <TableCell className="text-sm">
                  {p.items.length === 0 ? '—' : p.items.length === 1 ? (
                    <Link href={`/app/${orgSlug}/imoveis/${p.items[0].propertyId}`} className="hover:underline">
                      {p.items[0].title || p.items[0].code || 'Imóvel'}
                    </Link>
                  ) : (
                    <span>{p.items.length} imóveis</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">{p.contato_name || '—'}</TableCell>
                <TableCell className="text-sm">{p.operation_type === 'locacao' ? 'Locação' : 'Venda'}</TableCell>
                <TableCell className="text-sm tabular-nums">{formatCurrency(p.totalCents)}</TableCell>
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
                <TableCell>
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7"
                    title={p.public_token ? 'Copiar link público' : 'Gerar link público'}
                    disabled={linkBusyId === p.id}
                    onClick={() => handleLink(p.id, !!p.public_token)}
                  >
                    {linkBusyId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : p.public_token ? <Copy className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { resetForm(); onDialogClose?.() } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova proposta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {!fixedPropertyId && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Imóveis</label>
                <Input placeholder="Buscar por título ou código…" value={search} onChange={e => setSearch(e.target.value)} className="mb-1.5" />
                <div className="border rounded-md max-h-56 overflow-y-auto divide-y">
                  {filteredProperties.map(p => {
                    const checked = p.id in selected
                    return (
                      <div key={p.id} className="flex items-center gap-2.5 p-2">
                        <Checkbox checked={checked} onCheckedChange={v => toggleProperty(p.id, !!v)} />
                        <span className="text-sm flex-1 min-w-0 truncate">{p.title || p.code || 'Imóvel'}{p.code ? ` (${p.code})` : ''}</span>
                        {checked && (
                          <Input
                            inputMode="decimal" placeholder="Preço R$" className="w-28 h-8 text-sm"
                            value={selected[p.id]} onChange={e => setSelected(prev => ({ ...prev, [p.id]: e.target.value }))}
                          />
                        )}
                      </div>
                    )
                  })}
                  {filteredProperties.length === 0 && <p className="text-xs text-muted-foreground p-3 text-center">Nenhum imóvel encontrado.</p>}
                </div>
              </div>
            )}
            {fixedPropertyId && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Preço (R$)</label>
                <Input
                  inputMode="decimal" placeholder="0,00"
                  value={selected[fixedPropertyId] || ''}
                  onChange={e => setSelected(prev => ({ ...prev, [fixedPropertyId]: e.target.value }))}
                />
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
                <label className="text-xs font-medium text-muted-foreground">Válida até</label>
                <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Condições</label>
              <Textarea rows={3} value={conditions} onChange={e => setConditions(e.target.value)} placeholder="Forma de pagamento, prazo…" />
            </div>
            {Object.keys(selected).length > 0 && (
              <p className="text-sm text-right font-medium">Total: {formatCurrency(totalCents)}</p>
            )}
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
