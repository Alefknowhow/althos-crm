import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OnboardingForm from './OnboardingForm'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: { new?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Auto-redirect to existing org only on the "first-time" flow.
  // The org switcher passes ?new=1 when the user explicitly wants to create
  // an additional org, in which case we skip the redirect.
  const wantsNew = searchParams?.new === '1'

  if (!wantsNew) {
    const { data: memberships } = await supabase
      .from('memberships')
      .select('organizations(slug)')
      .eq('user_id', user.id)
      .limit(1)

    if (memberships && memberships.length > 0) {
      const o = memberships[0].organizations as any
      const slug = Array.isArray(o) ? o[0]?.slug : o?.slug
      if (slug) redirect(`/app/${slug}/pipeline`)
    }
  }

  return <OnboardingForm userEmail={user.email} isNewOrg={wantsNew} />
}
