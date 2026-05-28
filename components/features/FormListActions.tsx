'use client'

import { Button } from '@/components/ui/button'
import { toggleFormActive, deleteForm } from '@/actions/forms'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function FormListActions({ orgSlug, form }: { orgSlug: string, form: any }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const copyUrl = () => {
    navigator.clipboard.writeText(`${window.location.origin}/f/${form.slug}`)
    alert('URL copiada!')
  }

  return (
    <div className="flex gap-2 justify-end">
      <Button variant="ghost" size="sm" onClick={() => router.push(`/app/${orgSlug}/forms/${form.id}/edit`)}>Editar</Button>
      <Button variant="ghost" size="sm" onClick={copyUrl}>Copiar URL</Button>
      <Button variant="ghost" size="sm" disabled={loading} onClick={async () => {
        setLoading(true)
        await toggleFormActive(orgSlug, form.id, !form.is_active)
        setLoading(false)
      }}>
        {form.is_active ? 'Pausar' : 'Ativar'}
      </Button>
      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" disabled={loading} onClick={async () => {
        if(confirm('Tem certeza que deseja excluir o formulário e suas submissões?')) {
          setLoading(true)
          await deleteForm(orgSlug, form.id)
          setLoading(false)
        }
      }}>Excluir</Button>
    </div>
  )
}
