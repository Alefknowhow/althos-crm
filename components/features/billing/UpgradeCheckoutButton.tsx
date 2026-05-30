'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import CheckoutModal from './CheckoutModal'
import { Loader2 } from 'lucide-react'

type Props = {
  orgSlug:   string
  plan:      'starter' | 'pro' | 'scale'
  label:     string
  disabled?: boolean
  highlight?: boolean
}

/**
 * Button on the /upgrade page that opens the checkout modal
 * (payment method selector: PIX / Boleto / Cartão).
 */
export default function UpgradeCheckoutButton({ orgSlug, plan, label, disabled, highlight }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        disabled={disabled}
        variant={highlight ? 'default' : 'outline'}
        className="w-full"
      >
        {label}
      </Button>

      <CheckoutModal
        orgSlug={orgSlug}
        open={open}
        onClose={() => setOpen(false)}
        initialPlan={plan}
      />
    </>
  )
}
