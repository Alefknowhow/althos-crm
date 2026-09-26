'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Loader2, Search } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { createContract, type RelatedEntityType } from '@/actions/contracts-global'
import { listContractOriginOptions, getContractOriginOption, type SaleContractOption } from '@/actions/contracts-origin'

const ORIGIN_LABEL: Record<'reserva' | 'venda' | 'oportunidade', string> = {
  reserva: 'Reserva', venda: 'Venda', oportunidade: 'Oportunidade',
}

/**
 * Gestão de contratos — toda criação passa por aqui e exige uma origem
 * (Reserva, Venda ou Oportunidade — o cliente vem junto dela) além do
 * modelo (issue #60, B.2: generalizado do antigo picker fixo em Venda). A
 * empresa/agência contratada é sempre a própria organização (implícito —
 * nenhum campo, já é quem está logado). Signatários são adicionados depois,
 * na tela de detalhe (ContractSignersPanel), onde também mora o envio.
 */
export default function NewContractDialog({
  orgSlug, templates, open, onOpenChange, defaultOriginType = 'venda', prefillOrigin = null, onCreated,
}: {
  orgSlug: string
  templates: { id: string; name: string }[]
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultOriginType?: 'reserva' | 'venda'
  prefillOrigin?: { type: string; id: string } | null
  onCreated: (id: string) => void
}) {
  const [originType, setOriginType] = useState<'reserva' | 'venda' | 'oportunidade'>(defaultOriginType)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<SaleContractOption[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedSale, setSelectedSale] = useState<SaleContractOption | null>(null)
  const [title, setTitle] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!prefillOrigin) return
    const type = prefillOrigin.type as RelatedEntityType
    if (type !== 'reserva' && type !== 'venda' && type !== 'oportunidade') return
    setOriginType(type)
    getContractOriginOption(orgSlug, type, prefillOrigin.id).then(sale => {
      if (sale) pickSale(sale)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillOrigin])

  async function handleSearch(q: string) {
    setQuery(q)
    setSearching(true)
    const data = await listContractOriginOptions(orgSlug, originType, q)
    setSearching(false)
    setOptions(data)
  }

  function pickSale(sale: SaleContractOption) {
    setSelectedSale(sale)
    setOptions([])
    if (!title.trim()) setTitle(`Contrato — ${sale.label}`)
  }

  async function handleCreate() {
    if (!selectedSale) { toast.error('Selecione a origem do contrato.'); return }
    if (!title.trim()) { toast.error('Informe um título para o contrato.'); return }
    setSaving(true)
    const res = await createContract(orgSlug, {
      title,
      templateId: templateId || null,
      relatedEntityType: originType,
      relatedEntityId: selectedSale.id,
      valueCents: selectedSale.amountCents,
    })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    reset()
    onOpenChange(false)
    onCreated(res.id)
  }

  function reset() {
    setOriginType(defaultOriginType); setQuery(''); setOptions([]); setSelectedSale(null); setTitle(''); setTemplateId('')
  }

  function changeOriginType(type: 'reserva' | 'venda' | 'oportunidade') {
    setOriginType(type); setQuery(''); setOptions([]); setSelectedSale(null)
  }

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo contrato</DialogTitle>
          <DialogDescription>Todo contrato precisa estar vinculado a uma origem — o cliente é herdado dela.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Origem</Label>
            {!selectedSale && (
              <div className="flex items-center gap-1 rounded-md border p-0.5 w-fit">
                {(['reserva', 'venda', 'oportunidade'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => changeOriginType(type)}
                    className={cn(
                      'px-2.5 py-1 text-xs rounded-sm font-medium transition-colors',
                      originType === type ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary',
                    )}
                  >
                    {ORIGIN_LABEL[type]}
                  </button>
                ))}
              </div>
            )}
            {selectedSale ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{selectedSale.label}</p>
                  {selectedSale.amountCents != null && <p className="text-xs text-muted-foreground">{formatCurrency(selectedSale.amountCents)}</p>}
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedSale(null)}>Trocar</Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-8" placeholder={`Buscar ${ORIGIN_LABEL[originType].toLowerCase()} por cliente...`} value={query} onChange={e => handleSearch(e.target.value)} />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {searching && <p className="text-xs text-muted-foreground px-1 py-1">Buscando…</p>}
                  {!searching && options.map(o => (
                    <button key={o.id} type="button" onClick={() => pickSale(o)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted">
                      <span className="truncate">{o.label}</span>
                      {o.amountCents != null && <span className="text-muted-foreground shrink-0 ml-2">{formatCurrency(o.amountCents)}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Contrato de prestação de serviços — Cliente X" />
          </div>
          <div className="space-y-2">
            <Label>Modelo (opcional)</Label>
            <Select value={templateId || '__none__'} onValueChange={v => setTemplateId(v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Sem modelo — texto livre" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem modelo — texto livre</SelectItem>
                {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Modelos são gerenciados na aba Modelos.</p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={handleCreate} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Criando…</> : 'Criar contrato'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
