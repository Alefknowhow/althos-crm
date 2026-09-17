'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Search, FileEdit, BarChart2, Copy, MoreVertical, Trash2, Power } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toggleFormActive, deleteForm, duplicateForm } from '@/actions/forms'

export type FormListItem = {
  id: string
  name: string
  slug: string
  is_active: boolean
  created_at: string
  submissionCount: number
}

export default function FormsListGrid({ orgSlug, forms }: { orgSlug: string; forms: FormListItem[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return forms
    return forms.filter(f => f.name.toLowerCase().includes(q))
  }, [forms, query])

  async function handleToggle(form: FormListItem) {
    setBusyId(form.id)
    const res = await toggleFormActive(orgSlug, form.id, !form.is_active)
    setBusyId(null)
    if (!res.ok) { toast.error(res.error || 'Erro ao atualizar formulário'); return }
    toast.success(form.is_active ? 'Formulário pausado' : 'Formulário ativado')
    router.refresh()
  }

  async function handleDuplicate(formId: string) {
    setBusyId(formId)
    const res = await duplicateForm(orgSlug, formId)
    setBusyId(null)
    if (!res.ok || !res.form) { toast.error(res.ok ? 'Erro ao duplicar' : res.error); return }
    toast.success('Formulário duplicado')
    router.push(`/app/${orgSlug}/forms/${res.form.id}/edit`)
  }

  async function handleDelete() {
    if (!deleteId) return
    setBusyId(deleteId)
    const res = await deleteForm(orgSlug, deleteId)
    setBusyId(null)
    setDeleteId(null)
    if (!res.ok) { toast.error(res.error || 'Erro ao excluir formulário'); return }
    toast.success('Formulário excluído')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar formulário..."
          className="h-9 w-full rounded-full border border-input bg-muted/50 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg bg-card p-12 text-center text-muted-foreground">
          {forms.length === 0 ? 'Nenhum formulário criado. Comece criando o seu primeiro para captar leads.' : 'Nenhum formulário encontrado com essa busca.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map(form => (
            <div key={form.id} className="rounded-xl border bg-card p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/app/${orgSlug}/forms/${form.id}/edit`} className="text-sm font-semibold hover:underline truncate block">
                    {form.name}
                  </Link>
                  <p className="text-xs text-muted-foreground font-mono truncate">/f/{form.slug}</p>
                </div>
                <Badge className={`shrink-0 ${form.is_active ? 'bg-success text-success-foreground' : 'bg-muted-foreground/60 text-white'}`}>
                  {form.is_active ? 'Ativo' : 'Pausado'}
                </Badge>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold tabular-nums">{form.submissionCount}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {form.submissionCount === 1 ? 'resposta' : 'respostas'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 mt-auto">
                <Button variant="outline" size="sm" asChild className="flex-1 h-8 gap-1.5 text-xs">
                  <Link href={`/app/${orgSlug}/forms/${form.id}/edit`}>
                    <FileEdit className="w-3.5 h-3.5" /> Editar
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="flex-1 h-8 gap-1.5 text-xs">
                  <Link href={`/app/${orgSlug}/forms/${form.id}/respostas`}>
                    <BarChart2 className="w-3.5 h-3.5" /> Respostas
                  </Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" disabled={busyId === form.id}>
                      <MoreVertical className="w-3.5 h-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleDuplicate(form.id)} className="gap-2">
                      <Copy className="w-3.5 h-3.5" /> Duplicar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggle(form)} className="gap-2">
                      <Power className="w-3.5 h-3.5" /> {form.is_active ? 'Pausar' : 'Ativar'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setDeleteId(form.id)} className="gap-2 text-destructive focus:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir formulário?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O formulário e todas as suas submissões serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
