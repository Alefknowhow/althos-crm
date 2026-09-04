'use client'

/**
 * Knowledge-base management dialog for RoteiristaView. Split out of
 * RoteiristaView.tsx.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Plus, Trash2, BookOpen } from 'lucide-react'
import {
  addRoteiristaKnowledge, deleteRoteiristaKnowledge, type RoteiristaKnowledgeItem,
} from '@/actions/roteirista'

export function KnowledgeDialog({
  orgSlug, open, onOpenChange, initialItems,
}: {
  orgSlug: string
  open: boolean
  onOpenChange: (o: boolean) => void
  initialItems: RoteiristaKnowledgeItem[]
}) {
  const [items, setItems] = useState(initialItems)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!text.trim()) return
    setSaving(true)
    const res = await addRoteiristaKnowledge(orgSlug, text)
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    setItems(prev => [{ id: crypto.randomUUID(), content: text.trim(), is_active: true, created_at: new Date().toISOString() }, ...prev])
    setText('')
    toast.success('Conhecimento adicionado')
  }

  async function handleDelete(id: string) {
    const res = await deleteRoteiristaKnowledge(orgSlug, id)
    if (!res.ok) { toast.error(res.error); return }
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> Base de conhecimento</DialogTitle>
          <DialogDescription>
            Fatos que a IA considera ao conversar — ex.: &quot;Grand Palladium tem gratuidade para até 2 CHD de até 17 anos por quarto, acompanhado de adultos pagantes.&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Textarea rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="Escreva um conhecimento e clique em Adicionar…" />
          <div className="flex justify-end">
            <Button size="sm" disabled={saving || !text.trim()} onClick={handleAdd}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar
            </Button>
          </div>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum conhecimento cadastrado ainda.</p>
          ) : (
            items.map(item => (
              <div key={item.id} className="flex items-start gap-2 rounded-lg border p-2.5 text-sm">
                <p className="flex-1">{item.content}</p>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => handleDelete(item.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
