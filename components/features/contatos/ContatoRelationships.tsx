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

function formatDate(d: string | null) {
  if (!d) return null
  const [y, m, day] = d.split('-')
  return y && m && day ? `${day}/${m}/${y}` : d
}

export default function ContatoRelationships({ orgSlug, contatoId, initial }: Props) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  // 'existing' vincula com um contato já cadastrado; 'manual' cadastra a
  // pessoa direto na linha do parentesco (sem virar um contato/lead).
  const [mode, setMode] = useState<'existing' | 'manual'>('existing')
  const [kind, setKind] = useState<RelationshipKind | ''>('')
  const [relatedId, setRelatedId] = useState<string | null>(null)
  const [manualName, setManualName] = useState('')
  const [manualCpf, setManualCpf] = useState('')
  const [manualBirthDate, setManualBirthDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function resetForm() {
    setAdding(false)
    setMode('existing')
    setKind('')
    setRelatedId(null)
    setManualName('')
    setManualCpf('')
    setManualBirthDate('')
    setNote('')
  }

  const handleAdd = async () => {
    if (!kind) {
      toast.error('Selecione o tipo de vínculo.')
      return
    }
    if (mode === 'existing' && !relatedId) {
      toast.error('Selecione o contato relacionado.')
      return
    }
    if (mode === 'manual' && !manualName.trim()) {
      toast.error('Preencha o nome completo.')
      return
    }
    setSaving(true)
    const res = await addRelationship(orgSlug, {
      contatoId,
      kind,
      note: note || null,
      relatedContatoId: mode === 'existing' ? relatedId : null,
      relatedName: mode === 'manual' ? manualName.trim() : null,
      relatedCpf: mode === 'manual' ? manualCpf.trim() || null : null,
      relatedBirthDate: mode === 'manual' ? manualBirthDate || null : null,
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
            <Plus className="w-4 h-4 mr-1" /> Vincular
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {adding && (
          <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('existing')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${mode === 'existing' ? 'border-primary bg-primary/5 text-primary' : 'text-muted-foreground hover:bg-muted/40'}`}
              >
                Contato existente
              </button>
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${mode === 'manual' ? 'border-primary bg-primary/5 text-primary' : 'text-muted-foreground hover:bg-muted/40'}`}
              >
                Adicionar manualmente
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
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

              {mode === 'existing' ? (
                <>
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
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome completo</Label>
                    <Input
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="Ex.: João da Silva"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">CPF (opcional)</Label>
                    <Input
                      value={manualCpf}
                      onChange={(e) => setManualCpf(e.target.value)}
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nascimento (opcional)</Label>
                    <Input
                      type="date"
                      value={manualBirthDate}
                      onChange={(e) => setManualBirthDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-3">
                    <Label className="text-xs">Observação (opcional)</Label>
                    <Input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Ex.: filho mais novo, viaja sempre junto"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={resetForm}>
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
            {initial.map((rel) => {
              const details = [rel.related_cpf, formatDate(rel.related_birth_date)].filter(Boolean).join(' · ')
              return (
                <div
                  key={rel.id}
                  className="flex items-center justify-between gap-2 border-b last:border-0 pb-2 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="text-sm">
                      <span className="text-muted-foreground">
                        {RELATIONSHIP_LABELS[rel.kind] || rel.kind}:
                      </span>{' '}
                      {rel.related_contato_id ? (
                        <Link
                          href={`/app/${orgSlug}/contatos/${rel.related_contato_id}`}
                          className="font-medium hover:underline"
                        >
                          {rel.related_name || 'Contato'}
                        </Link>
                      ) : (
                        <span className="font-medium">{rel.related_name}</span>
                      )}
                    </div>
                    {details && (
                      <div className="text-xs text-muted-foreground mt-0.5">{details}</div>
                    )}
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
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
