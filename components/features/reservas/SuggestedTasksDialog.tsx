'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles } from 'lucide-react'
import { getSuggestedTasksForSale, generateTasksFromSuggestions } from '@/actions/travel-sales'

type Suggestion = {
  title: string
  description: string
  due_date: string
  priority: string
  source_product_id: string
  kind: string
}

const KIND_LABELS: Record<string, string> = {
  aereo: 'Aéreo', hospedagem: 'Hospedagem', transfer: 'Transfer', cruzeiro: 'Cruzeiro',
  passeio: 'Passeio', seguro: 'Seguro', ingresso: 'Ingresso', veiculo: 'Veículo', outro: 'Outro',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

export default function SuggestedTasksDialog({
  orgSlug, saleId, open, onOpenChange, onGenerated,
}: {
  orgSlug: string
  saleId: string
  open: boolean
  onOpenChange: (o: boolean) => void
  onGenerated: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getSuggestedTasksForSale(orgSlug, saleId).then(res => {
      setLoading(false)
      if (!res.ok) { toast.error(res.error); return }
      setSuggestions(res.suggestions)
      setChecked(new Set(res.suggestions.map((_, i) => i)))
    })
  }, [open, orgSlug, saleId])

  function toggle(i: number) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  async function handleGenerate() {
    const selected = suggestions.filter((_, i) => checked.has(i))
    setGenerating(true)
    const res = await generateTasksFromSuggestions(orgSlug, saleId, selected)
    setGenerating(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success(`${res.tasksCreated} tarefa(s) gerada(s).`)
    onOpenChange(false)
    onGenerated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Tarefas sugeridas</DialogTitle>
          <DialogDescription>
            Com base nos produtos desta venda. Desmarque o que não for necessário.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma sugestão — adicione produtos com data (voo, check-in, transfer…) na aba Produtos primeiro.
          </p>
        ) : (
          <div className="space-y-1.5">
            {suggestions.map((s, i) => (
              <label key={i} className="flex items-start gap-2.5 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/40">
                <input
                  type="checkbox"
                  className="mt-1 accent-primary w-4 h-4"
                  checked={checked.has(i)}
                  onChange={() => toggle(i)}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{s.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {fmtDate(s.due_date)} · {KIND_LABELS[s.kind] || s.kind}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={generating || checked.size === 0} onClick={handleGenerate}>
            {generating ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Gerando…</> : `Gerar ${checked.size} tarefa${checked.size !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
