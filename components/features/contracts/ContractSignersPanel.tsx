'use client'

/**
 * Signatários do contrato (issue #16 §6/§7) — pessoa existente no CRM
 * (busca em Contatos, reaproveitando searchLeads) OU informada manualmente
 * sem criar Contato. Suporta N signatários (tabela contract_signers), não
 * hardcoded em 2 como sale_contracts/plan_contracts.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Plus, X, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { searchLeads } from '@/actions/contatos-bulk'
import { addContractSigner, removeContractSigner } from '@/actions/contracts-global'

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  sent: 'bg-amber-100 text-amber-700',
  signed: 'bg-success text-success-foreground',
  rejected: 'bg-destructive text-destructive-foreground',
}

export default function ContractSignersPanel({
  orgSlug, contractId, signers, editable, onChange,
}: {
  orgSlug: string
  contractId: string
  signers: { id: string; name: string; email: string | null; phone: string | null; status: string }[]
  editable: boolean
  onChange: () => void
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'search' | 'manual'>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ id: string; name: string; email: string | null; phone: string | null }[]>([])
  const [manualName, setManualName] = useState('')
  const [manualEmail, setManualEmail] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSearch(q: string) {
    setQuery(q)
    if (q.trim().length < 2) { setResults([]); return }
    const data = await searchLeads(orgSlug, q, 8)
    setResults(data)
  }

  async function pickContato(c: { id: string; name: string; email: string | null; phone: string | null }) {
    setSaving(true)
    const res = await addContractSigner(orgSlug, contractId, { contatoId: c.id, name: c.name, email: c.email, phone: c.phone })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    setOpen(false); setQuery(''); setResults([])
    onChange()
  }

  async function addManual() {
    if (!manualName.trim()) { toast.error('Informe o nome.'); return }
    setSaving(true)
    const res = await addContractSigner(orgSlug, contractId, { name: manualName, email: manualEmail || null, phone: manualPhone || null })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    setOpen(false); setManualName(''); setManualEmail(''); setManualPhone('')
    onChange()
  }

  async function handleRemove(id: string) {
    const res = await removeContractSigner(orgSlug, id)
    if (!res.ok) { toast.error(res.error); return }
    onChange()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Signatários</p>
        {editable && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2" align="end">
              <div className="flex gap-1 mb-2">
                <button type="button" onClick={() => setMode('search')} className={cn('flex-1 rounded-md px-2 py-1 text-xs', mode === 'search' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>Contato existente</button>
                <button type="button" onClick={() => setMode('manual')} className={cn('flex-1 rounded-md px-2 py-1 text-xs', mode === 'manual' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>Informar manualmente</button>
              </div>
              {mode === 'search' ? (
                <div className="space-y-1.5">
                  <Input placeholder="Buscar por nome, e-mail ou telefone..." value={query} onChange={e => handleSearch(e.target.value)} className="h-8 text-xs" />
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {results.map(c => (
                      <button key={c.id} type="button" onClick={() => pickContato(c)} disabled={saving}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted">
                        <User className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{c.name}</span>
                        <span className="text-muted-foreground truncate">{c.email || c.phone}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Input placeholder="Nome" value={manualName} onChange={e => setManualName(e.target.value)} className="h-8 text-xs" />
                  <Input placeholder="E-mail" value={manualEmail} onChange={e => setManualEmail(e.target.value)} className="h-8 text-xs" />
                  <Input placeholder="Telefone" value={manualPhone} onChange={e => setManualPhone(e.target.value)} className="h-8 text-xs" />
                  <Button type="button" size="sm" className="w-full h-7 text-xs" onClick={addManual} disabled={saving}>Adicionar</Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>

      {signers.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum signatário adicionado.</p>
      ) : (
        <div className="space-y-1.5">
          {signers.map(s => (
            <div key={s.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground truncate">{s.email || s.phone || 'sem contato'}</p>
              </div>
              <Badge className={cn('text-[10px] shrink-0', STATUS_CLS[s.status])}>{s.status}</Badge>
              {editable && (
                <button type="button" onClick={() => handleRemove(s.id)} className="text-muted-foreground hover:text-destructive shrink-0" aria-label="Remover signatário">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
