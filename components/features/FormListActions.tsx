'use client'

import { Button } from '@/components/ui/button'
import { toggleFormActive, deleteForm } from '@/actions/forms'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export default function FormListActions({ orgSlug, form }: { orgSlug: string, form: any }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const copyUrl = () => {
    navigator.clipboard.writeText(`${window.location.origin}/f/${form.slug}`)
    toast.success('URL copiada!')
  }

  async function handleToggle() {
    setLoading(true)
    const res = await toggleFormActive(orgSlug, form.id, !form.is_active)
    setLoading(false)
    if (!res.ok) {
      toast.error(res.error || 'Erro ao atualizar formulário')
      return
    }
    toast.success(form.is_active ? 'Formulário pausado' : 'Formulário ativado')
    router.refresh()
  }

  async function handleDelete() {
    setLoading(true)
    const res = await deleteForm(orgSlug, form.id)
    setLoading(false)
    if (!res.ok) {
      toast.error(res.error || 'Erro ao excluir formulário')
      return
    }
    toast.success('Formulário excluído')
    router.refresh()
  }

  return (
    <div className="flex gap-2 justify-end">
      <Button variant="ghost" size="sm" onClick={() => router.push(`/app/${orgSlug}/forms/${form.id}/edit`)}>
        Editar
      </Button>
      <Button variant="ghost" size="sm" onClick={copyUrl}>
        Copiar URL
      </Button>
      <Button variant="ghost" size="sm" disabled={loading} onClick={handleToggle}>
        {form.is_active ? 'Pausar' : 'Ativar'}
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            disabled={loading}
          >
            Excluir
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir formulário?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O formulário e todas as suas submissões serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
