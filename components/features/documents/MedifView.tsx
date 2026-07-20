'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import MedifForm from './MedifForm'
import { cn } from '@/lib/utils'
import {
  createMedifRecord, updateMedifRecord, deleteMedifRecord,
  uploadMedifTemplate, removeMedifTemplate, getMedifTemplateUrl,
  type MedifRecordRow,
} from '@/actions/medif'
import { toast } from 'sonner'
import { HeartPulse, Plus, Trash2, ArrowLeft, Save, Upload, Download, FileIcon, X, Loader2 } from 'lucide-react'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

function fmtDate(d: string) {
  return new Date(d).toLocaleString('pt-BR')
}

function MedifTemplateCard({ orgSlug, templateInfo }: { orgSlug: string; templateInfo: { name: string } | null }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [opening, setOpening] = useState(false)

  async function handleUpload(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadMedifTemplate(orgSlug, fd)
    setUploading(false)
    if (res.ok) { toast.success('Modelo MEDIF enviado'); router.refresh() }
    else toast.error(res.error)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleDownload() {
    setOpening(true)
    const res = await getMedifTemplateUrl(orgSlug)
    setOpening(false)
    if (res.ok) window.open(res.url, '_blank', 'noopener,noreferrer')
    else toast.error(res.error)
  }

  async function handleRemove() {
    const res = await removeMedifTemplate(orgSlug)
    if (res.ok) { toast.success('Modelo removido'); router.refresh() }
    else toast.error(res.error)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><FileIcon className="w-4 h-4 text-primary" /> Modelo MEDIF (PDF)</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          O MEDIF é um formulário extenso, com assinatura física do médico e do passageiro — não é gerado pelo sistema.
          Envie aqui o modelo em branco da operadora pra deixar disponível para download pela equipe.
        </p>
        {templateInfo ? (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <FileIcon className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="flex-1 min-w-0 truncate text-sm">{templateInfo.name}</span>
            <Button variant="outline" size="sm" disabled={opening} onClick={handleDownload}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar
            </Button>
            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={handleRemove} aria-label="Remover modelo">
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
            <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Enviando…</> : <><Upload className="w-3.5 h-3.5 mr-1.5" /> Enviar modelo MEDIF</>}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function MedifView({
  orgSlug, records, templateInfo,
}: {
  orgSlug: string
  records: MedifRecordRow[]
  templateInfo: { name: string } | null
}) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(records[0]?.id ?? null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)

  const selected = records.find(r => r.id === selectedId) ?? null

  async function handleCreate() {
    setCreating(true)
    const res = await createMedifRecord(orgSlug, { data: {} })
    setCreating(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Registro MEDIF criado')
    setSelectedId(res.data.id)
    router.refresh()
  }

  async function handleSave(id: string, passengerName: string, data: Record<string, string>) {
    setSaving(true)
    const res = await updateMedifRecord(orgSlug, id, { passengerName, data })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Registro MEDIF salvo')
    router.refresh()
  }

  async function handleDelete(id: string) {
    const res = await deleteMedifRecord(orgSlug, id)
    if (res.ok) {
      toast.success('Registro excluído')
      if (selectedId === id) setSelectedId(null)
      router.refresh()
    } else toast.error(res.error)
  }

  return (
    <div className="space-y-4">
      <MedifTemplateCard orgSlug={orgSlug} templateInfo={templateInfo} />

      <div className="flex items-center justify-end">
        <Button onClick={handleCreate} disabled={creating}>
          <Plus className="w-4 h-4 mr-1.5" /> {creating ? 'Criando…' : 'Novo registro MEDIF'}
        </Button>
      </div>

      {records.length === 0 ? (
        <EmptyState
          icon={HeartPulse}
          title="Nenhum registro MEDIF ainda"
          description="Crie um registro pra guardar as informações médicas do passageiro (diagnóstico, sinais vitais, necessidades especiais etc.) — o PDF assinado continua sendo tratado fora do sistema."
        />
      ) : (
        <div className="grid md:grid-cols-[280px_1fr] gap-4 h-[calc(100dvh-24rem)] min-h-[440px]">
          <div className={cn('rounded-none border bg-card overflow-y-auto divide-y', selected && 'hidden md:block')}>
            {records.map(r => {
              const active = r.id === selectedId
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={cn('w-full text-left p-3 transition-colors', FOCUS_RING, active ? 'bg-primary/5' : 'hover:bg-muted/50')}
                >
                  <p className="font-medium text-sm truncate">{r.passenger_name || 'Sem nome'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(r.updated_at)}</p>
                </button>
              )
            })}
          </div>

          <div className={cn('rounded-none border bg-card overflow-y-auto', !selected && 'hidden md:flex')}>
            {selected
              ? <MedifEditor
                  key={selected.id}
                  record={selected}
                  saving={saving}
                  onBack={() => setSelectedId(null)}
                  onDelete={() => setDeleteId(selected.id)}
                  onSave={(name, data) => handleSave(selected.id, name, data)}
                />
              : (
                <div className="m-auto text-center text-sm text-muted-foreground p-8">
                  <HeartPulse className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Selecione um registro para ver os detalhes.
                </div>
              )}
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro MEDIF</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleDelete(deleteId!); setDeleteId(null) }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function MedifEditor({
  record, saving, onSave, onBack, onDelete,
}: {
  record: MedifRecordRow
  saving: boolean
  onSave: (passengerName: string, data: Record<string, string>) => void
  onBack: () => void
  onDelete: () => void
}) {
  const [passengerName, setPassengerName] = useState(record.passenger_name || '')
  const [data, setData] = useState<Record<string, string>>(record.data || {})

  function setField(key: string, value: string) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="flex flex-col w-full">
      <div className="sticky top-0 bg-card/90 border-b p-4 flex items-start gap-3 z-10">
        <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold truncate flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-primary shrink-0" /> {passengerName || 'Registro MEDIF'}
          </h2>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          <Button variant="outline" size="sm" disabled={saving} onClick={() => onSave(passengerName, data)}>
            <Save className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">{saving ? 'Salvando…' : 'Salvar'}</span>
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={onDelete} aria-label="Excluir">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="max-w-sm space-y-1">
          <Label className="text-xs text-muted-foreground">Nome do passageiro (referência na lista)</Label>
          <Input value={passengerName} onChange={e => setPassengerName(e.target.value)} />
        </div>

        <MedifForm data={data} onChange={setField} />
      </div>
    </div>
  )
}
