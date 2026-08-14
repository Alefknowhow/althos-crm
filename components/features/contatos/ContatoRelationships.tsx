'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Users, Loader2 } from 'lucide-react'
import { addRelationship, deleteRelationship } from '@/actions/relationships'
import {
  RELATIONSHIP_KINDS,
  RELATIONSHIP_LABELS,
  type RelationshipRow,
  type RelationshipKind,
} from '@/lib/relationships'

interface Props {
  orgSlug: string
  contatoId: string
  initial: RelationshipRow[]
}

export default function ContatoRelationships({ orgSlug, contatoId, initial }: Props) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<RelationshipKind | ''>('')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function resetForm() {
    setAdding(false)
    setKind('')
    setText('')
  }

  const handleAdd = async () => {
    if (!kind) {
      toast.error('Selecione o grau de parentesco.')
      return
    }
    if (!text.trim()) {
      toast.error('Escreva os dados da pessoa.')
      return
    }
    setSaving(true)
    const res = await addRelationship(orgSlug, {
      contatoId,
      kind,
      relatedName: text.trim(),
    })
    setSaving(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Vínculo adicionado.')
    resetForm()
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const res = await deleteRelationship(orgSlug, id, contatoId)
    setDeletingId(null)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Vínculo removido.')
    router.refresh()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4" /> Parentesco
        </CardTitle>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {adding && (
          <div className="flex items-center gap-2 rounded-lg border p-3 bg-muted/20">
            <Select value={kind} onValueChange={(v) => setKind(v as RelationshipKind)}>
              <SelectTrigger className="w-auto shrink-0 gap-1.5">
                <SelectValue placeholder="Escolher..." />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {RELATIONSHIP_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'Ex.: João da Silva, CPF 000.000.000-00, nascido em 20/06/2015...'}
              className="flex h-9 flex-1 min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button size="sm" variant="ghost" className="shrink-0" onClick={resetForm}>
              Cancelar
            </Button>
            <Button size="sm" className="shrink-0" onClick={handleAdd} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </div>
        )}

        {initial.length === 0 && !adding ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhum vínculo de parentesco cadastrado.
          </p>
        ) : (
          <div className="space-y-2">
            {initial.map((rel) => (
              <div
                key={rel.id}
                className="flex items-center justify-between gap-2 border-b last:border-0 pb-2 last:pb-0"
              >
                <div className="min-w-0 flex items-baseline gap-1.5 truncate">
                  <span className="text-xs text-muted-foreground shrink-0">
                    {RELATIONSHIP_LABELS[rel.kind] || rel.kind}:
                  </span>
                  <span className="text-sm truncate">{rel.related_name}</span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => handleDelete(rel.id)}
                  disabled={deletingId === rel.id}
                >
                  {deletingId === rel.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 text-destructive" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
