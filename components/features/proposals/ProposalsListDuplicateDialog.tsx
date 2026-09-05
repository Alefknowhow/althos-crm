'use client'

import { useMemo, useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { CheckCircle2, CopyPlus, Loader2, Search } from 'lucide-react'
import { duplicateProposal, type ProposalRow } from '@/actions/travel-proposals'

type Contato = { id: string; name: string }

export function DuplicateProposalDialog({
  orgSlug, proposal, contatos, onClose, onDone,
}: {
  orgSlug: string
  proposal: ProposalRow | null
  contatos: Contato[]
  onClose: () => void
  onDone: (newId: string) => void
}) {
  const [q, setQ] = useState('')
  const [targetId, setTargetId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Reset transient state whenever the dialog opens for a new proposal.
  useEffect(() => {
    if (proposal) { setQ(''); setTargetId(null); setSaving(false) }
  }, [proposal])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle
      ? contatos.filter(c => (c.name || '').toLowerCase().includes(needle))
      : contatos
    return list.slice(0, 50)
  }, [contatos, q])

  async function handleConfirm() {
    if (!proposal || !targetId) return
    setSaving(true)
    const res = await duplicateProposal(orgSlug, proposal.id, targetId)
    setSaving(false)
    if (!res.ok) { toast.error(res.error || 'Erro ao duplicar proposta'); return }
    toast.success('Cópia criada para o contato selecionado')
    onDone(res.data.id)
  }

  return (
    <Dialog open={!!proposal} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copiar proposta para outro lead</DialogTitle>
          <DialogDescription>
            Cria uma nova proposta com todo o conteúdo de
            {' '}<span className="font-medium text-foreground">{proposal?.title || 'proposta'}</span>{' '}
            vinculada ao contato escolhido. A nova cópia começa como rascunho e gera um novo link ao compartilhar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar contato pelo nome…"
              className="pl-8"
            />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border divide-y">
            {filtered.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Nenhum contato encontrado.</p>
            ) : filtered.map(c => {
              const active = c.id === targetId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setTargetId(c.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors',
                    active ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50',
                  )}
                >
                  <span className="truncate">{c.name || 'Sem nome'}</span>
                  {active && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!targetId || saving}>
            {saving
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Copiando…</>
              : <><CopyPlus className="w-4 h-4 mr-1.5" /> Criar cópia</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
