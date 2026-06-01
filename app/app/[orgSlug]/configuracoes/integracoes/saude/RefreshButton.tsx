'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { runHealthCheckNow } from '@/actions/health'

export default function RefreshButton({ orgSlug }: { orgSlug: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [running, setRunning] = useState(false)

  async function handle() {
    setRunning(true)
    try {
      const res = await runHealthCheckNow(orgSlug)
      if (res.ok) {
        toast.success('Verificação concluída')
        startTransition(() => router.refresh())
      } else {
        toast.error(res.error || 'Falha ao verificar')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao verificar')
    } finally {
      setRunning(false)
    }
  }

  const busy = running || pending
  return (
    <Button onClick={handle} disabled={busy} variant="outline" size="sm">
      <RefreshCw className={`h-4 w-4 mr-2 ${busy ? 'animate-spin' : ''}`} />
      {busy ? 'Verificando...' : 'Verificar agora'}
    </Button>
  )
}
