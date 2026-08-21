'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Loader2, Pencil, Archive, Building2, Upload } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { uploadSaleVoucher } from '@/actions/upload'
import { createInsurer, updateInsurer, archiveInsurer, type InsurerRow } from '@/actions/insurers'

export default function InsurersView({ orgSlug, insurers }: { orgSlug: string; insurers: InsurerRow[] }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [conditions, setConditions] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  function resetForm() {
    setEditingId(null); setName(''); setCnpj(''); setContactName(''); setContactPhone('')
    setContactEmail(''); setConditions(''); setLogoUrl('')
  }

  function openEdit(i: InsurerRow) {
    setEditingId(i.id); setName(i.name); setCnpj(i.cnpj || ''); setContactName(i.contact_name || '')
    setContactPhone(i.contact_phone || ''); setContactEmail(i.contact_email || '')
    setConditions(i.conditions || ''); setLogoUrl(i.logo_storage_key || '')
    setOpen(true)
  }

  async function handleLogoUpload(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadSaleVoucher(orgSlug, fd)
    setUploading(false)
    if (!res.ok) { toast.error(res.error); return }
    setLogoUrl(res.url)
  }

  async function handleSave() {
    if (!name.trim()) { toast.error('Informe o nome da seguradora.'); return }
    setSaving(true)
    const payload = {
      name, cnpj: cnpj || null, contactName: contactName || null, contactPhone: contactPhone || null,
      contactEmail: contactEmail || null, conditions: conditions || null, logoStorageKey: logoUrl || null,
    }
    const res = editingId ? await updateInsurer(orgSlug, editingId, payload) : await createInsurer(orgSlug, payload)
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success(editingId ? 'Seguradora atualizada' : 'Seguradora criada')
    setOpen(false); resetForm()
    router.refresh()
  }

  async function handleArchive(id: string) {
    if (!window.confirm('Arquivar esta seguradora? Ela deixa de aparecer nos seletores.')) return
    setBusyId(id)
    const res = await archiveInsurer(orgSlug, id)
    setBusyId(null)
    if (!res.ok) { toast.error(res.error); return }
    router.refresh()
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader
        title="Seguradoras"
        hint="Seguradoras parceiras da corretora."
        actions={
          <Button onClick={() => { resetForm(); setOpen(true) }}>
            <Plus className="w-4 h-4 mr-1.5" /> Nova seguradora
          </Button>
        }
      />
      <p className="text-sm text-muted-foreground">{insurers.length} seguradora{insurers.length === 1 ? '' : 's'}</p>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead>Nome</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {insurers.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Nenhuma seguradora cadastrada.</TableCell></TableRow>
            )}
            {insurers.map(i => (
              <TableRow key={i.id}>
                <TableCell>
                  {i.logo_storage_key ? (
                    <img src={i.logo_storage_key} alt="" className="w-8 h-8 object-contain rounded" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm font-medium">{i.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{i.cnpj || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{i.contact_name || i.contact_phone || i.contact_email || '—'}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={i.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-muted text-muted-foreground hover:bg-muted'}>
                    {i.is_active ? 'Ativa' : 'Inativa'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar" onClick={() => openEdit(i)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {i.is_active && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Arquivar" disabled={busyId === i.id} onClick={() => handleArchive(i.id)}>
                        <Archive className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetForm() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? 'Editar seguradora' : 'Nova seguradora'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="w-14 h-14 object-contain rounded border" />
              ) : (
                <div className="w-14 h-14 rounded border bg-muted flex items-center justify-center shrink-0">
                  <Building2 className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleLogoUpload(e.target.files)} />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />} Logo
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Nome</label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">CNPJ</label>
                <Input value={cnpj} onChange={e => setCnpj(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Contato</label>
                <Input value={contactName} onChange={e => setContactName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Telefone</label>
                <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">E-mail</label>
              <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Condições gerais</label>
              <Textarea rows={3} value={conditions} onChange={e => setConditions(e.target.value)} placeholder="Condições comerciais, prazos, observações…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} {editingId ? 'Salvar' : 'Criar seguradora'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
