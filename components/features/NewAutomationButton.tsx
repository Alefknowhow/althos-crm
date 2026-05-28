'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'
import { createAutomation } from '@/actions/automations'

export default function NewAutomationButton({ orgSlug }: { orgSlug: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)

  const handleClick = () => {
    setLoading(true)
    startTransition(async () => {
      try {
        const auto = await createAutomation(orgSlug, {
          name: 'Nova Automação',
          trigger_type: 'form.submitted',
          trigger_config: {},
          steps: [],
        })
        if (auto?.id) {
          router.push(`/app/${orgSlug}/automacoes/${auto.id}`)
        } else {
          toast.error('Não foi possível criar a automação')
          setLoading(false)
        }
      } catch (e: any) {
        toast.error(e?.message || 'Erro ao criar automação')
        setLoading(false)
      }
    })
  }

  return (
    <Button onClick={handleClick} disabled={loading || isPending}>
      <Zap className="w-4 h-4 mr-2" />
      {loading || isPending ? 'Criando...' : 'Nova Automação'}
    </Button>
  )
}
