'use client'

/**
 * New/edit event-type dialog form for EventTypesPanel. Prop-driven, split
 * out of EventTypesPanel.tsx.
 */

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Trash2 } from 'lucide-react'
import {
  listClinicSupplyRecipe, upsertClinicSupplyRecipe, deleteClinicSupplyRecipe,
  type ClinicSupplyRecipeRow,
} from '@/actions/clinic-estoque'

type Pipeline = { id: string; name: string }
type Stage = { id: string; name: string; pipeline_id: string }
type ClinicOption = { id: string; name: string }

export function EventTypesPanelDialog({
  label, labelLower, dialogOpen, setDialogOpen, editingId, draft, setDraft, saving, onOpenNew, onSubmit,
  pipelines, stages, isClinic, clinicSpecialties, clinicRooms, clinicProfessionals, clinicSupplies,
  orgSlug,
}: {
  label: string
  labelLower: string
  dialogOpen: boolean
  setDialogOpen: (o: boolean) => void
  editingId: string | null
  draft: any
  setDraft: (d: any) => void
  saving: boolean
  onOpenNew: () => void
  onSubmit: (e: React.FormEvent) => void
  pipelines: Pipeline[]
  stages: Stage[]
  isClinic: boolean
  clinicSpecialties: ClinicOption[]
  clinicRooms: ClinicOption[]
  clinicProfessionals: ClinicOption[]
  clinicSupplies: ClinicOption[]
  orgSlug: string
}) {
  const stagesForPipeline = stages.filter(s => !draft.pipeline_id || s.pipeline_id === draft.pipeline_id)

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button onClick={onOpenNew}>
          <Plus className="w-4 h-4 mr-1" /> Novo {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editingId ? `Editar ${labelLower}` : `Novo ${labelLower}`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2">
              <Label>Nome *</Label>
              <Input
                value={draft.name}
                onChange={e => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ex: Avaliação inicial 30min"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Duração (min) *</Label>
              <Input
                type="number"
                min={5}
                max={480}
                value={draft.duration_minutes}
                onChange={e => setDraft({ ...draft, duration_minutes: Number(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draft.color}
                  onChange={e => setDraft({ ...draft, color: e.target.value })}
                  className="h-9 w-12 rounded border cursor-pointer"
                />
                <Input
                  value={draft.color}
                  onChange={e => setDraft({ ...draft, color: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Descrição (aparece na página pública)</Label>
              <Textarea
                rows={2}
                value={draft.description}
                onChange={e => setDraft({ ...draft, description: e.target.value })}
                placeholder="Ex: Conversa inicial para entender suas necessidades."
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Local / Link</Label>
              <Input
                value={draft.location}
                onChange={e => setDraft({ ...draft, location: e.target.value })}
                placeholder="Ex: Av. Brasil 123 · ou link do Google Meet"
              />
            </div>

            <div className="space-y-2">
              <Label>Buffer antes (min)</Label>
              <Input
                type="number"
                min={0}
                max={120}
                value={draft.buffer_before_minutes}
                onChange={e =>
                  setDraft({ ...draft, buffer_before_minutes: Number(e.target.value) })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Buffer depois (min)</Label>
              <Input
                type="number"
                min={0}
                max={120}
                value={draft.buffer_after_minutes}
                onChange={e =>
                  setDraft({ ...draft, buffer_after_minutes: Number(e.target.value) })
                }
              />
            </div>

            {!isClinic && pipelines.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label>Pipeline para o lead</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
                    value={draft.pipeline_id}
                    onChange={e =>
                      setDraft({ ...draft, pipeline_id: e.target.value, stage_id: '' })
                    }
                  >
                    <option value="">(Nenhum)</option>
                    {pipelines.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Estágio inicial</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
                    value={draft.stage_id}
                    onChange={e => setDraft({ ...draft, stage_id: e.target.value })}
                    disabled={!draft.pipeline_id}
                  >
                    <option value="">(Padrão)</option>
                    {stagesForPipeline.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          {isClinic && (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contexto clínico</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Profissional</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
                    value={draft.professional_id}
                    onChange={e => setDraft({ ...draft, professional_id: e.target.value })}
                  >
                    <option value="">(Qualquer profissional)</option>
                    {clinicProfessionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Especialidade</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
                    value={draft.specialty_id}
                    onChange={e => setDraft({ ...draft, specialty_id: e.target.value })}
                  >
                    <option value="">(Nenhuma)</option>
                    {clinicSpecialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Sala padrão</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
                    value={draft.room_id}
                    onChange={e => setDraft({ ...draft, room_id: e.target.value })}
                  >
                    <option value="">(Nenhuma)</option>
                    {clinicRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Preço (R$)</Label>
                  <Input
                    type="number" min={0} step="0.01"
                    value={draft.price}
                    onChange={e => setDraft({ ...draft, price: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Desconto padrão (R$)</Label>
                  <Input
                    type="number" min={0} step="0.01"
                    value={draft.discount}
                    onChange={e => setDraft({ ...draft, discount: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
              </div>
            </div>
          )}

          {isClinic && editingId && clinicSupplies.length > 0 && (
            <SupplyRecipeEditor orgSlug={orgSlug} eventTypeId={editingId} supplies={clinicSupplies} />
          )}

          <DialogFooter>
            <Button type="submit" disabled={saving || draft.name.length < 2}>
              {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Receita de insumos por procedimento (Estoque, exclusivo Clínicas) — quanto
 * de cada insumo esse procedimento consome por uso. Salvo direto ao
 * adicionar/remover linha (sem depender do "Salvar" do procedimento), já
 * que a receita vive numa tabela própria (clinic_supply_recipe).
 */
function SupplyRecipeEditor({ orgSlug, eventTypeId, supplies }: { orgSlug: string; eventTypeId: string; supplies: ClinicOption[] }) {
  const [rows, setRows] = useState<ClinicSupplyRecipeRow[]>([])
  const [newSupplyId, setNewSupplyId] = useState('')
  const [newQty, setNewQty] = useState('')
  const [, startTransition] = useTransition()

  useEffect(() => {
    listClinicSupplyRecipe(orgSlug, eventTypeId).then(setRows)
  }, [orgSlug, eventTypeId])

  function handleAdd() {
    if (!newSupplyId || !newQty || Number(newQty) <= 0) return
    startTransition(async () => {
      const res = await upsertClinicSupplyRecipe(orgSlug, eventTypeId, newSupplyId, Number(newQty))
      if (res.ok) {
        toast.success('Insumo vinculado ao procedimento')
        setNewSupplyId('')
        setNewQty('')
        listClinicSupplyRecipe(orgSlug, eventTypeId).then(setRows)
      } else toast.error(res.error)
    })
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      const res = await deleteClinicSupplyRecipe(orgSlug, id)
      if (res.ok) setRows(r => r.filter(row => row.id !== id))
      else toast.error(res.error)
    })
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Insumos consumidos (baixa automática ao finalizar atendimento)</p>
      {rows.length > 0 && (
        <div className="space-y-1.5">
          {rows.map(r => (
            <div key={r.id} className="flex items-center justify-between text-sm rounded-md border px-2.5 py-1.5">
              <span>{r.supply_name} <span className="text-muted-foreground">— {r.quantity_per_use} {r.unit} por uso</span></span>
              <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => handleRemove(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Insumo</Label>
          <select className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm" value={newSupplyId} onChange={e => setNewSupplyId(e.target.value)}>
            <option value="">Selecione...</option>
            {supplies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="w-28 space-y-1">
          <Label className="text-xs">Qtd. por uso</Label>
          <Input type="number" min={0} step="0.001" value={newQty} onChange={e => setNewQty(e.target.value)} />
        </div>
        <Button type="button" variant="outline" onClick={handleAdd}>Adicionar</Button>
      </div>
    </div>
  )
}
