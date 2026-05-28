'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createCheckoutSession } from '@/actions/billing'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

type Props = {
  orgSlug: string
  plan:    'starter' | 'pro'
  label:   string
  disabled?: boolean
  highlight?: boolean
}

export default function UpgradeCheckoutButton({ orgSlug, plan, label, disabled, highlight }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const res = await createCheckoutSession(orgSlug, plan)
    setLoading(false)

    if (!res.ok) {
      toast.error(res.error)
      return
    }

    // Redirect to Asaas payment page
    window.location.href = res.checkoutUrl
  }

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || loading}
      variant={highlight ? 'default' : 'outline'}
      className="w-full"
    >
      {loading ? (
        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Aguarde...</>
      ) : label}
    </Button>
  )
}
