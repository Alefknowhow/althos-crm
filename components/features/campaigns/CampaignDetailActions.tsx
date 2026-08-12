'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RotateCw, X } from 'lucide-react'
import { cancelCampaign, resendFailedRecipient } from '@/actions/send-campaigns'

interface Props {
  orgSlug: string
  campaign: { id: string; status: string }
}

export default function CampaignDetailActions({ orgSlug, campaign }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (!['scheduled', 'sending'].includes(campaign.status)) return null

  function handleCancel() {
    if (!confirm('Cancelar essa campanha? Destinatários ainda não processados não serão enviados.')) return
    startTransition(async () => {
      await cancelCampaign(orgSlug, campaign.id)
      router.refresh()
    })
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCancel} disabled={pending} className="gap-1.5">
      <X className="w-3.5 h-3.5" />
      Cancelar campanha
    </Button>
  )
}

export function ResendRecipient({ orgSlug, recipientId }: { orgSlug: string; recipientId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleResend() {
    startTransition(async () => {
      await resendFailedRecipient(orgSlug, recipientId)
      router.refresh()
    })
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleResend} disabled={pending} className="h-6 gap-1 text-xs ml-1.5">
      <RotateCw className="w-3 h-3" />
      Reenviar
    </Button>
  )
}
