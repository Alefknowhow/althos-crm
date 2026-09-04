'use client'

/**
 * "Pacotes" tab content for TratamentosClient: dialog, list, delete
 * confirmation. Owns its own state — split out of TratamentosClient.tsx.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, PackageCheck, CheckCircle2 } from 'lucide-react'
import LeadCombobox from '@/components/features/LeadCombobox'
import {
  type ClinicPackageRow, type ClinicPackageInput,
  createClinicPackage, updateClinicPackage, deleteClinicPackage,
  setClinicPackageStatus, consumeClinicPackageSession,
} from '@/actions/clinic-packages'
import {
  CLINIC_PACKAGE_STATUSES, CLINIC_PACKAGE_STATUS_LABEL, type ClinicPackageStatus,
} from '@/lib/clinic-constants'

type Professional = { id: string; name: string }

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

const PACKAGE_STATUS_COLOR: Record<ClinicPackageStatus, string> = {
  ativo: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
  utilizado: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
  expirado: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  cancelado: 'bg-muted text-muted-foreground',
}

const EMPTY_PACKAGE: ClinicPackageInput = {
  patient_contato_id: '', professional_id: null, name: '', total_sessions: 1, value_cents: null, valid_until: null,
}

export function PacotesTab({
  orgSlug, initialPackages, professionals,
}: {
  orgSlug: string
  initialPackages: ClinicPackageRow[]
  professionals: Professional[]
}) {
  const router = useRouter()
  const [packages, setPackages] = useState(initialPackages)

  const [pDialogOpen, setPDialogOpen] = useState(false)
  const [pEditingId, setPEditingId] = useState<string | null>(null)
  const [pPatientLabel, setPPatientLabel] = useState<{ id: string; name: string } | null>(null)
  const [pDraft, setPDraft] = useState<ClinicPackageInput>(EMPTY_PACKAGE)
  const [pSaving, setPSaving] = useState(false)
  const [pToDelete, setPToDelete] = useState<ClinicPackageRow | null>(null)

  function refresh() { router.refresh() }

  function openNewPackage() {
    setPEditingId(null)
    setPDraft(EMPTY_PACKAGE)
    setPPatientLabel(null)
    setPDialogOpen(true)
  }
  function openEditPackage(row: ClinicPackageRow) {
    setPEditingId(row.id)
    setPPatientLabel({ id: row.patient_contato_id, name: row.patient_name })
    setPDraft({
      patient_contato_id: row.patient_contato_id,
      professional_id: null,
      name: row.name,
      total_sessions: row.total_sessions,
      value_cents: row.value_cents,
      valid_until: row.valid_until,
    })
    setPDialogOpen(true)
  }
  async function handleSavePackage(e: React.FormEvent) {
    e.preventDefault()
    setPSaving(true)
    const res = pEditingId
      ? await updateClinicPackage(orgSlug, pEditingId, pDraft)
      : await createClinicPackage(orgSlug, pDraft)
    setPSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success(pEditingId ? 'Pacote atualizado' : 'Pacote criado')
    setPDialogOpen(false)
    refresh()
  }
  async function handleDeletePackage(row: ClinicPackageRow) {
    const res = await deleteClinicPackage(orgSlug, row.id)
    if (!res.ok) { toast.error(res.error); return }
    setPackages(prev => prev.filter(p => p.id !== row.id))
    toast.success('Pacote excluído')
  }
  async function handlePackageStatus(row: ClinicPackageRow, status: ClinicPackageStatus) {
    const res = await setClinicPackageStatus(orgSlug, row.id, status)
    if (!res.ok) { toast.error(res.error); return }
    setPackages(prev => prev.map(p => (p.id === row.id ? { ...p, status } : p)))
  }
  async function handleConsumeSession(row: ClinicPackageRow) {
    const res = await consumeClinicPackageSession(orgSlug, row.id)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Sessão consumida')
    refresh()
  }

  return (
    <TabsContent value="pacotes" className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {packages.length === 0 ? 'Nenhum pacote criado ainda' : `${packages.length} pacote(s)`}
        </p>
        <Dialog open={pDialogOpen} onOpenChange={setPDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewPackage}><Plus className="w-4 h-4 mr-1" /> Novo pacote</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{pEditingId ? 'Editar pacote' : 'Novo pacote'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSavePackage} className="space-y-4">
              <div className="space-y-2">
                <Label>Paciente *</Label>
                <LeadCombobox
                  name="patient"
                  orgSlug={orgSlug}
                  defaultLead={pPatientLabel ? { id: pPatientLabel.id, name: pPatientLabel.name } : null}
                  onChange={lead => setPDraft(d => ({ ...d, patient_contato_id: lead?.id || '' }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Nome do pacote *</Label>
                <Input value={pDraft.name} onChange={e => setPDraft({ ...pDraft, name: e.target.value })} placeholder="Ex: Pacote 10 sessões — Pilates" required />
              </div>
              {!pEditingId && (
                <div className="space-y-2">
                  <Label>Profissional responsável (para comissão)</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
                    value={pDraft.professional_id || ''}
                    onChange={e => setPDraft({ ...pDraft, professional_id: e.target.value || null })}
                  >
                    <option value="">(Nenhum)</option>
                    {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Total de sessões *</Label>
                  <Input type="number" min={1} value={pDraft.total_sessions} onChange={e => setPDraft({ ...pDraft, total_sessions: Number(e.target.value) || 1 })} />
                </div>
                <div className="space-y-2">
                  <Label>Válido até</Label>
                  <Input type="date" value={pDraft.valid_until || ''} onChange={e => setPDraft({ ...pDraft, valid_until: e.target.value || null })} />
                </div>
              </div>
              {!pEditingId && (
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number" min={0} step="0.01"
                    value={(pDraft.value_cents || 0) / 100}
                    onChange={e => setPDraft({ ...pDraft, value_cents: Math.round((Number(e.target.value) || 0) * 100) })}
                  />
                  <p className="text-xs text-muted-foreground">Se informado, cria um lançamento de receita no Financeiro.</p>
                </div>
              )}
              <DialogFooter>
                <Button type="submit" disabled={pSaving || !pDraft.patient_contato_id}>
                  {pSaving ? 'Salvando...' : pEditingId ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {packages.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
          <PackageCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum pacote criado ainda.</p>
        </div>
      ) : (
        <div className="rounded-md border divide-y">
          {packages.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{p.name}</span>
                  <Badge variant="outline" className={PACKAGE_STATUS_COLOR[p.status]}>{CLINIC_PACKAGE_STATUS_LABEL[p.status]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {p.patient_name}{p.value_cents ? ` · ${fmtCurrency(p.value_cents)}` : ''}
                  {p.valid_until ? ` · válido até ${new Date(p.valid_until + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
                </p>
                <div className="flex items-center gap-2 mt-1.5 max-w-xs">
                  <Progress value={(p.sessions_used / p.total_sessions) * 100} className="h-1.5" />
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">{p.sessions_used}/{p.total_sessions}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleConsumeSession(p)} disabled={p.sessions_used >= p.total_sessions}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Sessão
              </Button>
              <select
                className="h-8 rounded-md border border-input bg-input/25 px-2 text-xs"
                value={p.status}
                onChange={e => handlePackageStatus(p, e.target.value as ClinicPackageStatus)}
              >
                {CLINIC_PACKAGE_STATUSES.map(s => <option key={s} value={s}>{CLINIC_PACKAGE_STATUS_LABEL[s]}</option>)}
              </select>
              <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEditPackage(p)}><Pencil className="w-3.5 h-3.5" /></Button>
              <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:bg-destructive/10" onClick={() => setPToDelete(p)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!pToDelete} onOpenChange={o => !o && setPToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pacote?</AlertDialogTitle>
            <AlertDialogDescription>{pToDelete ? `Excluir o pacote "${pToDelete.name}"? ` : ''}Essa ação não pode ser desfeita. Um eventual lançamento financeiro já criado não é removido automaticamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { handleDeletePackage(pToDelete!); setPToDelete(null) }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TabsContent>
  )
}
