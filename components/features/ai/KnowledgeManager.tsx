'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Sparkles } from 'lucide-react'
import {
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
  type KnowledgeItem,
} from '@/actions/ai_attendant'

const SUGGESTED_CATEGORIES = [
  'Preços',
  'Procedimentos',
  'Horários e Localização',
  'Pagamento',
  'Política de Cancelamento',
  'Diferenciais',
  'Geral',
]

export default function KnowledgeManager({
  orgSlug,
  initial,
}: {
  orgSlug: string
  initial: KnowledgeItem[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [items, setItems] = useState(initial)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState({
    category: '',
    question: '',
    answer: '',
    priority: 0,
    is_active: true,
  })
  const [saving, setSaving] = useState(false)

  function refresh() {
    startTransition(() => router.refresh())
  }

  function openNew() {
    setEditingId(null)
    setDraft({ category: '', question: '', answer: '', priority: 0, is_active: true })
    setDialogOpen(true)
  }

  function openEdit(item: KnowledgeItem) {
    setEditingId(item.id)
    setDraft({
      category: item.category || '',
      question: item.question,
      answer: item.answer,
      priority: item.priority,
      is_active: item.is_active,
    })
    setDialogOpen(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...draft,
      category: draft.category || null,
    }
    const res = editingId
      ? await updateKnowledge(orgSlug, editingId, payload)
      : await createKnowledge(orgSlug, payload)
    setSaving(false)
    if (res.ok) {
      toast.success(editingId ? 'Atualizado' : 'Adicionado')
      setDialogOpen(false)
      refresh()
    } else {
      toast.error((res as any).error || 'Erro')
    }
  }

  async function remove(item: KnowledgeItem) {
    if (!window.confirm(`Remover "${item.question}"?`)) return
    const res = await deleteKnowledge(orgSlug, item.id)
    if (res.ok) {
      toast.success('Removido')
      refresh()
    } else {
      toast.error(res.error || 'Erro')
    }
  }

  async function toggleActive(item: KnowledgeItem, val: boolean) {
    const res = await updateKnowledge(orgSlug, item.id, { is_active: val })
    if (res.ok) {
      setItems(prev => prev.map(i => (i.id === item.id ? { ...i, is_active: val } : i)))
    } else {
      toast.error(res.error || 'Erro')
    }
  }

  const grouped = new Map<string, KnowledgeItem[]>()
  for (const i of items) {
    const cat = i.category || 'Geral'
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(i)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {items.length === 0
            ? 'Nenhuma entrada ainda'
            : `${items.length} entrada(s) · ${items.filter(i => i.is_active).length} ativas`}
        </p>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="w-4 h-4 mr-1" /> Nova entrada
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar' : 'Nova entrada'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input
                  value={draft.category}
                  onChange={e => setDraft({ ...draft, category: e.target.value })}
                  list="suggested-categories"
                  placeholder="Ex: Preços"
                />
                <datalist id="suggested-categories">
                  {SUGGESTED_CATEGORIES.map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-2">
                <Label>Pergunta *</Label>
                <Input
                  required
                  value={draft.question}
                  onChange={e => setDraft({ ...draft, question: e.target.value })}
                  placeholder="Ex: Quanto custa o procedimento X?"
                />
              </div>

              <div className="space-y-2">
                <Label>Resposta *</Label>
                <Textarea
                  required
                  rows={4}
                  value={draft.answer}
                  onChange={e => setDraft({ ...draft, answer: e.target.value })}
                  placeholder="Ex: O procedimento X custa entre R$ 800 e R$ 1.200 dependendo da região tratada. O valor final é definido na avaliação presencial gratuita."
                />
                <p className="text-xs text-muted-foreground">
                  Escreva com naturalidade — a IA vai parafrasear na hora da resposta.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={draft.priority}
                    onChange={e =>
                      setDraft({ ...draft, priority: parseInt(e.target.value) || 0 })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    0–100. Mais alto = mais visível no prompt.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center gap-2 h-9">
                    <Switch
                      checked={draft.is_active}
                      onCheckedChange={c => setDraft({ ...draft, is_active: c })}
                    />
                    <span className="text-sm">{draft.is_active ? 'Ativa' : 'Pausada'}</span>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Adicionar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-3">
            <Sparkles className="w-10 h-10 mx-auto opacity-40" />
            <p>
              Comece adicionando perguntas e respostas comuns. Quanto mais detalhado, melhor o
              atendente vai responder.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([cat, list]) => (
            <Card key={cat}>
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {cat}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {list.map(item => (
                  <div
                    key={item.id}
                    className="border rounded-md p-3 flex items-start gap-3 hover:bg-muted/30 transition-colors"
                  >
                    <Switch
                      checked={item.is_active}
                      onCheckedChange={c => toggleActive(item, c)}
                      className="mt-1 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className={`text-sm font-medium ${item.is_active ? '' : 'opacity-50 line-through'}`}>
                          {item.question}
                        </p>
                        {item.priority > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            P{item.priority}
                          </Badge>
                        )}
                      </div>
                      <p className={`text-xs text-muted-foreground whitespace-pre-wrap ${item.is_active ? '' : 'opacity-50'}`}>
                        {item.answer}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => remove(item)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
