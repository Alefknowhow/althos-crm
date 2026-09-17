'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { activateVoiceAccount } from '@/actions/voice'

export function VoiceActivationCard({ orgSlug }: { orgSlug: string }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleActivate() {
    startTransition(async () => {
      const res = await activateVoiceAccount(orgSlug)
      if (!res.ok) { toast.error(res.error); return }
      toast.success('Althos Voice ativado.')
      router.refresh()
    })
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-sm">Ativar Althos Voice</CardTitle>
        <CardDescription>
          Cria uma subconta de telefonia dedicada para esta organização. Depois de ativar, você
          poderá comprar números e configurar gravações/limites.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleActivate} disabled={pending}>
          {pending ? 'Ativando...' : 'Ativar Althos Voice'}
        </Button>
      </CardContent>
    </Card>
  )
}
