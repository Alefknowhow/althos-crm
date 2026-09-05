'use client'

import { Button } from '@/components/ui/button'
import { Settings, Megaphone, Receipt } from 'lucide-react'
import NewAdAccountDialog from './NewAdAccountDialog'
import NewCampaignDialog from './NewCampaignDialog'
import RecordSpendDialog from './RecordSpendDialog'
import { triggerButtonProps, type TriggerVariant, type Account, type Campaign } from './MarketingOverviewShared'

/* -------- Trigger wrappers (open dialogs from dropdown items) -------- */

export function NewAccountTrigger({
  orgSlug,
  onDone,
  variant = 'outline',
  label = 'Nova conta de anúncio',
}: {
  orgSlug: string
  onDone: () => void
  variant?: TriggerVariant
  label?: string
}) {
  return (
    <NewAdAccountDialog
      orgSlug={orgSlug}
      onDone={onDone}
      trigger={
        <Button {...triggerButtonProps(variant)}>
          <Settings className="w-4 h-4 mr-2" /> {label}
        </Button>
      }
    />
  )
}

export function NewCampaignTrigger({
  orgSlug,
  accounts,
  onDone,
  variant = 'outline',
}: {
  orgSlug: string
  accounts: Account[]
  onDone: () => void
  variant?: TriggerVariant
}) {
  return (
    <NewCampaignDialog
      orgSlug={orgSlug}
      accounts={accounts}
      onDone={onDone}
      trigger={
        <Button {...triggerButtonProps(variant)}>
          <Megaphone className="w-4 h-4 mr-2" /> Nova campanha
        </Button>
      }
    />
  )
}

export function RecordSpendTrigger({
  orgSlug,
  campaigns,
  onDone,
  variant = 'outline',
}: {
  orgSlug: string
  campaigns: Campaign[]
  onDone: () => void
  variant?: TriggerVariant
}) {
  return (
    <RecordSpendDialog
      orgSlug={orgSlug}
      campaigns={campaigns}
      onDone={onDone}
      trigger={
        <Button {...triggerButtonProps(variant)}>
          <Receipt className="w-4 h-4 mr-2" /> Lançar gasto diário
        </Button>
      }
    />
  )
}
