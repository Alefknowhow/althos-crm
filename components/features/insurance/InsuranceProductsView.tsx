'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Loader2, Pencil, Archive } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import {
  createInsuranceProduct, updateInsuranceProduct, archiveInsuranceProduct,
  type InsuranceProductRow,
} from '@/actions/insurance-products'

export default function InsuranceProductsView({ orgSlug, products }: { orgSlug: string; products: InsuranceProductRow[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  function resetForm() {
    setEditingId(null); setName(''); setDescription('')
  }

  function openEdit(p: InsuranceProductRow) {
    setEditingId(p.id); setName(p.name); setDescription(p.description || '')
    setOpen(true)
  }

  async function handleSave() {
    if (!name.trim()) { toast.error('Informe o nome do produto.'); return }
    setSaving(true)
    const res = editingId
      ? await updateInsuranceProduct(orgSlug, editingId, { name, description: description || null })
      : await createInsuranceProduct(orgSlug, { name, description: description || null })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success(editingId ? 'Produto atualizado' : 'Produto criado')
    setOpen(false); resetForm()
    router.refresh()
  }

  async function handleArchive(id: string) {
    if (!window.confirm('Arquivar este produto? Ele deixa de aparecer nos seletores.')) return
    setBusyId(id)
    const res = await archiveInsuranceProduct(orgSlug, id)
    setBusyId(null)
    if (!res.ok) { toast.error(res.error); return }
    router.refresh()
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader
        title="Produtos de Seguro"
        hint="Catálogo de tipos de seguro oferecidos (Auto, Residencial, Vida, etc.)."
        actions={
          <Button onClick={() => { resetForm(); setOpen(true) }}>
            <Plus className="w-4 h-4 mr-1.5" /> Novo produto
          </Button>
        }
      />
      <p className="text-sm text-muted-foreground">{products.length} produto{products.length === 1 ? '' : 's'}</p>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">Nenhum produto cadastrado.</TableCell></TableRow>
            )}
            {products.map(p => (
              <TableRow key={p.id}>
                <TableCell className="text-sm font-medium">{p.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground truncate max-w-xs">{p.description || '—'}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={p.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-muted text-muted-foreground hover:bg-muted'}>
                    {p.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar" onClick={() => openEdit(p)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {p.is_active && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Arquivar" disabled={busyId === p.id} onClick={() => handleArchive(p.id)}>
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
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Editar produto' : 'Novo produto'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome</label>
              <Input placeholder="Auto, Residencial, Vida…" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Descrição</label>
              <Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Observações sobre o produto…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} {editingId ? 'Salvar' : 'Criar produto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
