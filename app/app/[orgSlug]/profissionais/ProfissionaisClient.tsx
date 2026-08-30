'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, Users, Stethoscope, DoorOpen } from 'lucide-react'
import {
  type ClinicProfessional, type ClinicSpecialty, type ClinicRoom, type ClinicProfessionalInput,
  createClinicProfessional, updateClinicProfessional, deleteClinicProfessional,
  createClinicSpecialty, updateClinicSpecialty, deleteClinicSpecialty,
  createClinicRoom, updateClinicRoom, deleteClinicRoom,
} from '@/actions/clinic'

// Altura igual pros 3 blocos — o que não couber rola dentro do próprio
// bloco, os vizinhos nunca são empurrados (mesma regra usada no dashboard).
const BLOCK_H = 'h-[560px]'

export default function ProfissionaisClient({
  orgSlug, initialProfessionals, initialSpecialties, initialRooms,
}: {
  orgSlug: string
  initialProfessionals: ClinicProfessional[]
  initialSpecialties: ClinicSpecialty[]
  initialRooms: ClinicRoom[]
}) {
  const router = useRouter()
  const [professionals, setProfessionals] = useState(initialProfessionals)
  const [specialties, setSpecialties] = useState(initialSpecialties)
  const [rooms, setRooms] = useState(initialRooms)

  function refresh() { router.refresh() }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
      <ProfessionalsPanel
        orgSlug={orgSlug}
        professionals={professionals}
        specialties={specialties}
        onChange={setProfessionals}
        onRefresh={refresh}
      />

      <SimpleCatalogPanel
        title="Especialidades"
        icon={Stethoscope}
        items={specialties}
        onChange={setSpecialties}
        onRefresh={refresh}
        create={(orgSlug, name) => createClinicSpecialty(orgSlug, name)}
        update={(orgSlug, id, patch) => updateClinicSpecialty(orgSlug, id, patch)}
        remove={(orgSlug, id) => deleteClinicSpecialty(orgSlug, id)}
        orgSlug={orgSlug}
      />

      <SimpleCatalogPanel
        title="Salas"
        icon={DoorOpen}
        items={rooms}
        onChange={setRooms}
        onRefresh={refresh}
        create={(orgSlug, name) => createClinicRoom(orgSlug, name)}
        update={(orgSlug, id, patch) => updateClinicRoom(orgSlug, id, patch)}
        remove={(orgSlug, id) => deleteClinicRoom(orgSlug, id)}
        orgSlug={orgSlug}
      />
    </div>
  )
}

// ── Profissionais ────────────────────────────────────────────────────────────

const EMPTY_PROFESSIONAL: ClinicProfessionalInput = {
  name: '', specialty_id: null, registration_no: null, commission_pct: null,
}

function ProfessionalsPanel({
  orgSlug, professionals, specialties, onChange, onRefresh,
}: {
  orgSlug: string
  professionals: ClinicProfessional[]
  specialties: ClinicSpecialty[]
  onChange: (v: ClinicProfessional[]) => void
  onRefresh: () => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ClinicProfessionalInput>(EMPTY_PROFESSIONAL)
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<ClinicProfessional | null>(null)

  const specialtyName = (id: string | null) => specialties.find(s => s.id === id)?.name || '—'

  function openNew() { setEditingId(null); setDraft(EMPTY_PROFESSIONAL); setDialogOpen(true) }
  function openEdit(p: ClinicProfessional) {
    setEditingId(p.id)
    setDraft({ name: p.name, specialty_id: p.specialty_id, registration_no: p.registration_no, commission_pct: p.commission_pct })
    setDialogOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = editingId
      ? await updateClinicProfessional(orgSlug, editingId, draft)
      : await createClinicProfessional(orgSlug, draft)
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success(editingId ? 'Profissional atualizado' : 'Profissional criado')
    setDialogOpen(false)
    onRefresh()
  }

  async function handleDelete(p: ClinicProfessional) {
    const res = await deleteClinicProfessional(orgSlug, p.id)
    if (!res.ok) { toast.error(res.error); return }
    onChange(professionals.filter(x => x.id !== p.id))
    toast.success('Profissional excluído')
  }

  return (
    <Card className={`${BLOCK_H} flex flex-col`}>
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" /> Profissionais
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? 'Editar profissional' : 'Novo profissional'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Especialidade</Label>
                  <Select value={draft.specialty_id || '__none__'} onValueChange={v => setDraft({ ...draft, specialty_id: v === '__none__' ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem especialidade</SelectItem>
                      {specialties.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Registro profissional</Label>
                    <Input value={draft.registration_no || ''} onChange={e => setDraft({ ...draft, registration_no: e.target.value || null })} placeholder="Ex: CRM 12345" />
                  </div>
                  <div className="space-y-2">
                    <Label>Comissão (%)</Label>
                    <Input type="number" min={0} max={100} step="0.1" value={draft.commission_pct ?? ''} onChange={e => setDraft({ ...draft, commission_pct: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving || draft.name.trim().length < 2}>{saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <p className="text-xs text-muted-foreground">
          {professionals.length === 0 ? 'Nenhum profissional cadastrado' : `${professionals.length} profissional(is)`}
        </p>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-y-auto pt-0">
        {professionals.length > 0 && (
          <div className="rounded-md border divide-y">
            {professionals.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{p.name}</span>
                    {!p.active && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{specialtyName(p.specialty_id)}{p.registration_no ? ` · ${p.registration_no}` : ''}</p>
                </div>
                <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0 text-destructive hover:bg-destructive/10" onClick={() => setToDelete(p)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!toDelete} onOpenChange={o => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir profissional?</AlertDialogTitle>
            <AlertDialogDescription>{toDelete ? `Excluir "${toDelete.name}"? ` : ''}Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { handleDelete(toDelete!); setToDelete(null) }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

// ── Especialidades / Salas — catálogo simples reutilizável ──────────────────

type SimpleItem = { id: string; name: string; active: boolean }

function SimpleCatalogPanel<T extends SimpleItem>({
  orgSlug, title, icon: Icon, items, onChange, onRefresh, create, update, remove,
}: {
  orgSlug: string
  title: string
  icon: any
  items: T[]
  onChange: (v: T[]) => void
  onRefresh: () => void
  create: (orgSlug: string, name: string) => Promise<{ ok: boolean; error?: string }>
  update: (orgSlug: string, id: string, patch: { name?: string; active?: boolean }) => Promise<{ ok: boolean; error?: string }>
  remove: (orgSlug: string, id: string) => Promise<{ ok: boolean; error?: string }>
}) {
  const [adding, setAdding] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<T | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!draftName.trim()) return
    setSaving(true)
    const res = await create(orgSlug, draftName)
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success(`${title.slice(0, -1)} criado(a)`)
    setDraftName('')
    setAdding(false)
    onRefresh()
  }

  async function handleToggle(item: T, active: boolean) {
    const res = await update(orgSlug, item.id, { active })
    if (!res.ok) { toast.error(res.error); return }
    onChange(items.map(i => (i.id === item.id ? { ...i, active } : i)))
  }

  async function handleDelete(item: T) {
    const res = await remove(orgSlug, item.id)
    if (!res.ok) { toast.error(res.error); return }
    onChange(items.filter(i => i.id !== item.id))
    toast.success('Excluído')
  }

  return (
    <Card className={`${BLOCK_H} flex flex-col`}>
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted-foreground" /> {title}
          </CardTitle>
          <Dialog open={adding} onOpenChange={setAdding}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setDraftName('')}><Plus className="w-4 h-4 mr-1" /> Nova</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova {title.toLowerCase().slice(0, -1)}</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input value={draftName} onChange={e => setDraftName(e.target.value)} required autoFocus />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving || draftName.trim().length < 2}>{saving ? 'Salvando...' : 'Criar'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <p className="text-xs text-muted-foreground">
          {items.length === 0 ? `Nenhuma ${title.toLowerCase().slice(0, -1)} cadastrada` : `${items.length} item(ns)`}
        </p>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-y-auto pt-0">
        {items.length > 0 && (
          <div className="rounded-md border divide-y">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-2 px-3 py-2.5">
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
                {!item.active && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
                <Button variant="ghost" size="sm" className="shrink-0" onClick={() => handleToggle(item, !item.active)}>
                  {item.active ? 'Pausar' : 'Ativar'}
                </Button>
                <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0 text-destructive hover:bg-destructive/10" onClick={() => setToDelete(item)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!toDelete} onOpenChange={o => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir?</AlertDialogTitle>
            <AlertDialogDescription>{toDelete ? `Excluir "${toDelete.name}"? ` : ''}Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { handleDelete(toDelete!); setToDelete(null) }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
