'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Users, Loader2 } from 'lucide-react'
import LeadCombobox from '@/components/features/LeadCombobox'
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
  const [relatedId, setRelatedId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!kind) {
      toast.error('Selecione o tipo de vínculo.')
      return
    }
    if (!relatedId) {
      toast.error('Selecione o contato relacionado.')
      return
    }
    setSaving(true)
    const res = await addRelationship(orgSlug, {
      contatoId,
      relatedContatoId: relatedId,
      kind,
      note: note || null,
    })
    setSaving(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Vínculo adicionado.')
    setAdding(false)
    setKind('')
    setRelatedId(null)
    setNote('')
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
            <Plus className="w-4 h-4 mr-1" /> Vincular
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {adding && (
          <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de vínculo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as RelationshipKind)}>
                <SelectTrigger>
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
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contato relacionado</Label>
              <LeadCombobox
                name="related_contato"
                orgSlug={orgSlug}
                placeholder="Buscar contato..."
                onChange={(c) => setRelatedId(c?.id || null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Observação (opcional)</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex.: responsável financeiro"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAdding(false)
                  setKind('')
                  setRelatedId(null)
                  setNote('')
                }}
              >
                Cancelar
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Salvar
              </Button>
            </div>
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
                <div className="min-w-0">
                  <div className="text-sm">
                    <span className="text-muted-foreground">
                      {RELATIONSHIP_LABELS[rel.kind] || rel.kind}:
                    </span>{' '}
                    <Link
                      href={`/app/${orgSlug}/contatos/${rel.related_contato_id}`}
                      className="font-medium hover:underline"
                    >
                      {rel.related_name || 'Contato'}
                    </Link>
                  </div>
                  {rel.note && (
                    <div className="text-xs text-muted-foreground italic mt-0.5">{rel.note}</div>
                  )}
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
