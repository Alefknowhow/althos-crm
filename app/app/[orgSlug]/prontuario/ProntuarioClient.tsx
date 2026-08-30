'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, FileText, ShieldAlert, ShieldCheck } from 'lucide-react'
import LeadCombobox from '@/components/features/LeadCombobox'
import {
  type ClinicMedicalRecordRow, type ClinicMedicalRecordInput, type ClinicPatientConsent,
  listClinicMedicalRecords, createClinicMedicalRecord, updateClinicMedicalRecord, deleteClinicMedicalRecord,
  getActiveClinicConsent, recordClinicConsent,
} from '@/actions/clinic-medical-records'

type Professional = { id: string; name: string }

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function emptyDraft(patientId: string): ClinicMedicalRecordInput {
  return {
    patient_contato_id: patientId, professional_id: null, attendance_id: null,
    entry_date: new Date().toISOString(), subjective: null, objective: null, assessment: null, plan: null,
  }
}

export default function ProntuarioClient({ orgSlug, professionals }: { orgSlug: string; professionals: Professional[] }) {
  const [, startTransition] = useTransition()
  const [patient, setPatient] = useState<{ id: string; name: string } | null>(null)
  const [records, setRecords] = useState<ClinicMedicalRecordRow[]>([])
  const [loading, setLoading] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ClinicMedicalRecordInput | null>(null)
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<ClinicMedicalRecordRow | null>(null)

  const [consent, setConsent] = useState<ClinicPatientConsent | null>(null)
  const [consentChecked, setConsentChecked] = useState(false)
  const [consentDialogOpen, setConsentDialogOpen] = useState(false)
  const [consentMethod, setConsentMethod] = useState<'verbal' | 'termo_assinado' | 'digital'>('verbal')
  const [savingConsent, setSavingConsent] = useState(false)

  async function loadRecords(patientId: string) {
    setLoading(true)
    setConsentChecked(false)
    const [rows, activeConsent] = await Promise.all([
      listClinicMedicalRecords(orgSlug, patientId),
      getActiveClinicConsent(orgSlug, patientId),
    ])
    setLoading(false)
    setRecords(rows)
    setConsent(activeConsent)
    setConsentChecked(true)
  }

  function handlePatientChange(lead: { id: string; name: string } | null) {
    setPatient(lead)
    setRecords([])
    setConsent(null)
    setConsentChecked(false)
    if (lead) startTransition(() => loadRecords(lead.id))
  }

  async function handleRecordConsent() {
    if (!patient) return
    setSavingConsent(true)
    const res = await recordClinicConsent(orgSlug, patient.id, consentMethod)
    setSavingConsent(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Consentimento registrado')
    setConsentDialogOpen(false)
    loadRecords(patient.id)
  }

  function openNew() {
    if (!patient) return
    setEditingId(null)
    setDraft(emptyDraft(patient.id))
    setDialogOpen(true)
  }

  function openEdit(row: ClinicMedicalRecordRow) {
    setEditingId(row.id)
    setDraft({
      patient_contato_id: row.patient_contato_id,
      professional_id: row.professional_id,
      attendance_id: row.attendance_id,
      entry_date: row.entry_date,
      subjective: row.subjective,
      objective: row.objective,
      assessment: row.assessment,
      plan: row.plan,
    })
    setDialogOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!draft) return
    setSaving(true)
    const res = editingId
      ? await updateClinicMedicalRecord(orgSlug, editingId, draft)
      : await createClinicMedicalRecord(orgSlug, draft)
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success(editingId ? 'Evolução atualizada' : 'Evolução registrada')
    setDialogOpen(false)
    if (patient) loadRecords(patient.id)
  }

  async function handleDelete(row: ClinicMedicalRecordRow) {
    const res = await deleteClinicMedicalRecord(orgSlug, row.id)
    if (!res.ok) { toast.error(res.error); return }
    setRecords(prev => prev.filter(r => r.id !== row.id))
    toast.success('Evolução excluída')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>Dado de saúde sensível — todo acesso (visualizar, criar, editar, excluir) fica registrado em log de auditoria.</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[240px] max-w-sm">
          <LeadCombobox
            name="patient"
            orgSlug={orgSlug}
            defaultLead={patient}
            onChange={handlePatientChange}
          />
        </div>
        {patient && consentChecked && !consent && (
          <Dialog open={consentDialogOpen} onOpenChange={setConsentDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-500/10">
                <ShieldAlert className="w-4 h-4 mr-1" /> Registrar consentimento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar consentimento de {patient.name}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Tratamento de dado de saúde exige consentimento específico do paciente (LGPD art. 11), separado do consentimento genérico de uso da plataforma.
                </p>
                <div className="space-y-2">
                  <Label>Como o consentimento foi obtido?</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
                    value={consentMethod}
                    onChange={e => setConsentMethod(e.target.value as typeof consentMethod)}
                  >
                    <option value="verbal">Verbal, no atendimento</option>
                    <option value="termo_assinado">Termo assinado (papel)</option>
                    <option value="digital">Digital (assinatura eletrônica)</option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleRecordConsent} disabled={savingConsent}>
                  {savingConsent ? 'Salvando...' : 'Registrar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        {patient && consent && (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" /> Consentimento registrado ({new Date(consent.given_at).toLocaleDateString('pt-BR')})
          </span>
        )}
        {patient && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nova evolução</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingId ? 'Editar evolução' : 'Nova evolução'}</DialogTitle></DialogHeader>
              {draft && (
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Profissional</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
                        value={draft.professional_id || ''}
                        onChange={e => setDraft({ ...draft, professional_id: e.target.value || null })}
                      >
                        <option value="">(Nenhum)</option>
                        {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Data</Label>
                      <Input
                        type="datetime-local"
                        value={toDatetimeLocal(draft.entry_date)}
                        onChange={e => setDraft({ ...draft, entry_date: new Date(e.target.value).toISOString() })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Subjetivo</Label>
                    <Textarea rows={2} value={draft.subjective || ''} onChange={e => setDraft({ ...draft, subjective: e.target.value || null })} placeholder="Relato do paciente, queixa principal..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Objetivo</Label>
                    <Textarea rows={2} value={draft.objective || ''} onChange={e => setDraft({ ...draft, objective: e.target.value || null })} placeholder="Exame físico, achados observáveis..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Avaliação</Label>
                    <Textarea rows={2} value={draft.assessment || ''} onChange={e => setDraft({ ...draft, assessment: e.target.value || null })} placeholder="Hipótese/diagnóstico..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Plano</Label>
                    <Textarea rows={2} value={draft.plan || ''} onChange={e => setDraft({ ...draft, plan: e.target.value || null })} placeholder="Conduta, prescrição, próximos passos..." />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : editingId ? 'Salvar' : 'Registrar'}</Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!patient ? (
        <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Selecione um paciente para ver o prontuário.</p>
        </div>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : records.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma evolução registrada para {patient.name} ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(r => (
            <Card key={r.id}>
              <CardContent className="py-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.entry_date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    {r.professional_name ? ` · ${r.professional_name}` : ''}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:bg-destructive/10" onClick={() => setToDelete(r)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {r.subjective && <div><span className="text-xs font-semibold text-muted-foreground">Subjetivo: </span>{r.subjective}</div>}
                  {r.objective && <div><span className="text-xs font-semibold text-muted-foreground">Objetivo: </span>{r.objective}</div>}
                  {r.assessment && <div><span className="text-xs font-semibold text-muted-foreground">Avaliação: </span>{r.assessment}</div>}
                  {r.plan && <div><span className="text-xs font-semibold text-muted-foreground">Plano: </span>{r.plan}</div>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={o => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evolução?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { handleDelete(toDelete!); setToDelete(null) }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
