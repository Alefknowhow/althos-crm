'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createForm } from '@/actions/forms'

export default function NewFormButton({ orgSlug }: { orgSlug: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)

  const handleClick = () => {
    setLoading(true)
    startTransition(async () => {
      try {
        const res = await createForm(orgSlug, 'Novo Formulário')
        if (res.ok && res.form) {
          router.push(`/app/${orgSlug}/forms/${res.form.id}/edit`)
        } else {
          toast.error(res.error || 'Não foi possível criar o formulário')
          setLoading(false)
        }
      } catch (e: any) {
        toast.error(e?.message || 'Erro inesperado ao criar formulário')
        setLoading(false)
      }
    })
  }

  return (
    <Button onClick={handleClick} disabled={loading || isPending}>
      {loading || isPending ? 'Criando...' : '+ Novo Formulário'}
    </Button>
  )
}
