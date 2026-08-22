'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Loader2, FileText, Upload, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { uploadSaleVoucher } from '@/actions/upload'
import {
  createClaim, setClaimStatus, addClaimDocument, removeClaimDocument,
  type InsuranceClaimRow, type InsuranceClaimStatus,
} from '@/actions/insurance-claims'
import type { InsurancePolicyRow } from '@/actions/insurance-policies'

const STATUS_LABELS: Record<InsuranceClaimStatus, string> = {
  aberto: 'Aberto', em_analise: 'Em análise', aguardando_documentos: 'Aguardando documentos',
  em_regulacao: 'Em regulação', aprovado: 'Aprovado', negado: 'Negado', concluido: 'Concluído',
}
const STATUS_COLORS: Record<InsuranceClaimStatus, string> = {
  aberto: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  em_analise: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  aguardando_documentos: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  em_regulacao: 'bg-violet-100 text-violet-700 hover:bg-violet-100',
  aprovado: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  negado: 'bg-red-100 text-red-700 hover:bg-red-100',
  concluido: 'bg-muted text-muted-foreground hover:bg-muted',
}
const STATUS_ORDER: InsuranceClaimStatus[] = [
  'aberto', 'em_analise', 'aguardando_documentos', 'em_regulacao', 'aprovado', 'negado', 'concluido',
]

function fmtDate(d: string) { return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') }

export default function InsuranceClaimsView({
  orgSlug, claims, policies,
}: {
  orgSlug: string
  claims: InsuranceClaimRow[]
  policies: InsurancePolicyRow[]
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [policyId, setPolicyId] = useState('')
  const [claimType, setClaimType] = useState('')
  const [occurredAt, setOccurredAt] = useState('')
  const [protocolNumber, setProtocolNumber] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [docsClaimId, setDocsClaimId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const activePolicies = policies.filter(p => p.status === 'ativa' || p.status === 'em_emissao')
  const docsClaim = claims.find(c => c.id === docsClaimId) || null

  function resetForm() {
    setPolicyId(''); setClaimType(''); setOccurredAt(''); setProtocolNumber(''); setDescription('')
  }

  async function handleCreate() {
    const policy = policies.find(p => p.id === policyId)
    if (!policy) { toast.error('Escolha a apólice.'); return }
    setSaving(true)
    const res = await createClaim(orgSlug, {
      policyId, contatoId: policy.contato_id, claimType: claimType || null,
      occurredAt: occurredAt || null, protocolNumber: protocolNumber || null, description: description || null,
    })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Sinistro registrado')
    setOpen(false); resetForm()
    router.refresh()
  }

  async function handleStatus(id: string, status: InsuranceClaimStatus) {
    setBusyId(id)
    const res = await setClaimStatus(orgSlug, id, status)
    setBusyId(null)
    if (!res.ok) { toast.error(res.error); return }
    router.refresh()
  }

  async function handleUploadDoc(files: FileList | null) {
    const file = files?.[0]
    if (!file || !docsClaimId) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadSaleVoucher(orgSlug, fd)
    if (!res.ok) { toast.error(res.error); setUploading(false); return }
    const addRes = await addClaimDocument(orgSlug, docsClaimId, { storageKey: res.url, label: res.name })
    setUploading(false)
    if (!addRes.ok) { toast.error(addRes.error); return }
    router.refresh()
  }

  async function handleRemoveDoc(id: string) {
    const res = await removeClaimDocument(orgSlug, id)
    if (!res.ok) { toast.error(res.error); return }
    router.refresh()
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader
        title="Sinistros"
        hint="Acompanhamento de sinistros por apólice."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Novo sinistro
          </Button>
        }
      />
      <p className="text-sm text-muted-foreground">{claims.length} sinistro{claims.length === 1 ? '' : 's'}</p>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Apólice</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Seguradora</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Protocolo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Nenhum sinistro registrado ainda.</TableCell></TableRow>
            )}
            {claims.map(c => (
              <TableRow key={c.id}>
                <TableCell className="text-sm">{c.policy_number || '—'}</TableCell>
                <TableCell className="text-sm">{c.contato_name || '—'}</TableCell>
                <TableCell className="text-sm">{c.insurer_name || '—'}</TableCell>
                <TableCell className="text-sm">{c.claim_type || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.occurred_at ? fmtDate(c.occurred_at) : '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.protocol_number || '—'}</TableCell>
                <TableCell>
                  <Select value={c.status} onValueChange={v => handleStatus(c.id, v as InsuranceClaimStatus)} disabled={busyId === c.id}>
                    <SelectTrigger className="w-[170px] h-7 text-xs border-0 p-0 [&>span]:inline-block">
                      <Badge className={STATUS_COLORS[c.status]} variant="secondary"><SelectValue /></Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_ORDER.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Documentos" onClick={() => setDocsClaimId(c.id)}>
                    <FileText className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetForm() }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo sinistro</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Apólice</label>
              <Select value={policyId} onValueChange={setPolicyId}>
                <SelectTrigger><SelectValue placeholder="Escolher apólice…" /></SelectTrigger>
                <SelectContent>
                  {activePolicies.map(p => <SelectItem key={p.id} value={p.id}>{p.policy_number} — {p.contato_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Tipo de sinistro</label>
                <Input value={claimType} onChange={e => setClaimType(e.target.value)} placeholder="Colisão, roubo…" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Data do ocorrido</label>
                <Input type="date" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Protocolo (seguradora)</label>
              <Input value={protocolNumber} onChange={e => setProtocolNumber(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Descrição</label>
              <Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="O que aconteceu…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Registrar sinistro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!docsClaimId} onOpenChange={o => !o && setDocsClaimId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Documentos do sinistro</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {docsClaim?.documents.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum documento ainda.</p>}
            {docsClaim?.documents.map(d => (
              <div key={d.id} className="flex items-center gap-2 border rounded-md p-2">
                <a href={d.storageKey} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-sm hover:underline">{d.label || 'Documento'}</a>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleRemoveDoc(d.id)}>
                  <X className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ))}
            <input ref={fileRef} type="file" className="hidden" onChange={e => handleUploadDoc(e.target.files)} />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />} Adicionar documento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
