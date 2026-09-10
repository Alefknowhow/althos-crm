'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { purchaseVoiceCredits } from '@/actions/voice'
import { VOICE_CREDIT_PACKS } from '@/lib/voice/credit-packs'

export function VoiceBuyCreditsButton({ orgSlug }: { orgSlug: string }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleBuy(packId: typeof VOICE_CREDIT_PACKS[number]['id']) {
    startTransition(async () => {
      const res = await purchaseVoiceCredits(orgSlug, packId)
      if (!res.ok) { toast.error(res.error); return }
      if (res.paymentUrl) window.open(res.paymentUrl, '_blank')
      toast.success('Cobrança gerada — conclua o pagamento para liberar os créditos.')
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Comprar créditos</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Comprar Althos Voice Credits</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {VOICE_CREDIT_PACKS.map(p => (
            <Button key={p.id} variant="outline" disabled={pending} onClick={() => handleBuy(p.id)}>{p.label}</Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
