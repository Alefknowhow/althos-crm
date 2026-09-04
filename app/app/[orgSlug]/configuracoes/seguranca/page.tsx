import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getMfaStatus } from '@/actions/mfa'
import SecurityClient from './SecurityClient'

export const dynamic = 'force-dynamic'

export default async function SegurancaPage({ params: _params }: { params: { orgSlug: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const status = await getMfaStatus()

  return (
    <SecurityClient
      initialEnabled={status.enabled}
      initialRecoveryRemaining={status.recoveryRemaining}
    />
  )
}
