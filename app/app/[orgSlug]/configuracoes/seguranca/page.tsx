import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getMfaStatus } from '@/actions/mfa'
import SettingsTabsNav from '../SettingsTabsNav'
import SecurityClient from './SecurityClient'

export const dynamic = 'force-dynamic'

export default async function SegurancaPage({ params }: { params: { orgSlug: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const status = await getMfaStatus()

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie sua conta, organizações, membros e integrações.</p>
      </div>

      <SettingsTabsNav orgSlug={params.orgSlug} />

      <SecurityClient
        initialEnabled={status.enabled}
        initialRecoveryRemaining={status.recoveryRemaining}
      />
    </div>
  )
}
