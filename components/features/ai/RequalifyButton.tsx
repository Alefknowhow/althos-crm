'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Sparkles, Loader2 } from 'lucide-react'
import { requestLeadQualification } from '@/actions/contatos'

export default function RequalifyButton({ orgSlug, leadId, asMenuItem }: { orgSlug: string; leadId: string; asMenuItem?: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handle() {
    setLoading(true)
    try {
      const res = await requestLeadQualification(orgSlug, leadId)
      if (res.ok) {
        toast.success(`Score IA: ${(res as any).score}/100 · ${(res as any).tier?.toUpperCase()}`)
        router.refresh()
      } else {
        toast.error((res as any).reason || 'Erro ao qualificar lead')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  if (asMenuItem) {
    return (
      <DropdownMenuItem onSelect={e => { e.preventDefault(); handle() }} disabled={loading}>
        {loading
          ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
          : <Sparkles className="w-3.5 h-3.5 mr-2" />
        }
        {loading ? 'Analisando...' : 'Score IA'}
      </DropdownMenuItem>
    )
  }

  return (
    <Button variant="outline" size="sm" onClick={handle} disabled={loading}>
      {loading
        ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        : <Sparkles className="w-3.5 h-3.5 mr-1.5" />
      }
      {loading ? 'Analisando...' : 'Score IA'}
    </Button>
  )
}
