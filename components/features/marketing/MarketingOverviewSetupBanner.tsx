'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Megaphone } from 'lucide-react'
import { NewAccountTrigger, NewCampaignTrigger } from './MarketingOverviewTriggers'
import type { Account } from './MarketingOverviewShared'

export default function MarketingOverviewSetupBanner({
  orgSlug,
  accounts,
  noAccountsYet,
  noCampaignsYet,
  onDone,
}: {
  orgSlug: string
  accounts: Account[]
  noAccountsYet: boolean
  noCampaignsYet: boolean
  onDone: () => void
}) {
  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardContent className="p-5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Megaphone className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold mb-1">Comece em 2 passos</p>
          <p className="text-sm text-muted-foreground mb-3">
            {noAccountsYet
              ? '1. Conecte sua conta de anúncio (Meta, Google). 2. Escolha quais contas sincronizar — os dados aparecem aqui automaticamente, sem passo manual extra.'
              : '1. Cadastre uma campanha vinculada à conta. 2. Lance gastos diários ou importe um CSV exportado do Meta/Google.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {noAccountsYet && <NewAccountTrigger orgSlug={orgSlug} onDone={onDone} variant="default" />}
            {!noAccountsYet && noCampaignsYet && (
              <NewCampaignTrigger orgSlug={orgSlug} accounts={accounts} onDone={onDone} variant="default" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
