import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import Sidebar from '@/components/features/Sidebar'
import OrganizationSwitcher from '@/components/features/OrganizationSwitcher'
import { createClient } from '@/lib/supabase/server'
import { PRESET_COLORS } from '@/lib/constants/colors'
import ImpersonationBanner from '@/components/features/dashboard/ImpersonationBanner'
import NotificationBell from '@/components/features/NotificationBell'
import { ModeToggle } from '@/components/features/ModeToggle'
import { HelpTooltip } from '@/components/ui/help-tooltip'
import { CommandPaletteTrigger } from '@/components/features/CommandPalette'
import OnboardingTour from '@/components/features/OnboardingTour'
import PushNotificationToggle from '@/components/features/PushNotificationToggle'
import OrgSetupWizard from '@/components/features/OrgSetupWizard'
import TrialBanner from '@/components/features/billing/TrialBanner'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { isAccessBlocked } from '@/lib/billing/plans'

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string }
}) {
  const user = await requireAuth()
  const org  = await getCurrentOrganization(params.orgSlug)

  // ── Billing gate ────────────────────────────────────────────────────────────
  // Skip when the user is already on /upgrade (prevent infinite redirect).
  const pathname      = headers().get('x-pathname') ?? ''
  const isUpgradePage = pathname.endsWith('/upgrade')

  if (!isUpgradePage) {
    const orgFull = org as any
    if (isAccessBlocked({
      plan:                       orgFull.plan ?? null,
      trial_ends_at:              orgFull.trial_ends_at ?? null,
      subscription_status:        orgFull.subscription_status ?? null,
      billing_managed_externally: orgFull.billing_managed_externally ?? null,
    })) {
      redirect(`/app/${params.orgSlug}/upgrade`)
    }
  }

  const supabase = createClient()
  // Filter by user.id explicitly so super-admins only see their OWN orgs
  // in the switcher (not every org in the system via the super-admin RLS policy).
  const { data: memberships } = await supabase
    .from('memberships')
    .select('organizations(id, name, slug)')
    .eq('user_id', user.id)

  const orgs: { id: string; name: string; slug: string }[] =
    memberships?.flatMap(m => {
      const o = m.organizations as any
      if (!o) return []
      return Array.isArray(o) ? o : [o]
    }) || []

  const userName = (user.user_metadata as any)?.full_name as string | undefined

  // Inject saved primary color so it persists on every full page load.
  // Also fetch onboarding_completed to conditionally show the setup wizard.
  const { data: orgStyle } = await supabase
    .from('organizations')
    .select('primary_color, onboarding_completed')
    .eq('id', org.id)
    .maybeSingle()
  const savedPreset = PRESET_COLORS.find(c => c.hex === orgStyle?.primary_color)
  const primaryCSS  = savedPreset ? `--primary: ${savedPreset.hsl};` : ''
  const onboardingCompleted = orgStyle?.onboarding_completed ?? false

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {primaryCSS && (
        <style dangerouslySetInnerHTML={{ __html: `:root { ${primaryCSS} }` }} />
      )}
      {!onboardingCompleted && (
        <OrgSetupWizard orgSlug={params.orgSlug} initialName={org.name} />
      )}
      <TrialBanner orgId={org.id} orgSlug={params.orgSlug} plan={(org as any).plan ?? null} />
      <OnboardingTour userName={userName} />
      <ImpersonationBanner />
      <div className="flex flex-1">
        <Sidebar orgSlug={params.orgSlug} />

        <div className="flex-1 flex flex-col min-w-0">
          {/* pl-14 on mobile leaves space for the fixed sidebar hamburger
              rendered by SidebarShell. md+ uses normal padding since the
              desktop aside occupies its own column. */}
          <header className="h-14 border-b border-border bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 flex items-center pl-14 pr-3 md:px-5 justify-between sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <span className="hidden md:inline text-sm font-medium tracking-apple-snug text-muted-foreground">
                {org.name}
              </span>
              <OrganizationSwitcher currentSlug={params.orgSlug} organizations={orgs} />
            </div>

            <div className="flex items-center gap-2">
              <CommandPaletteTrigger orgSlug={params.orgSlug} />
              <Link
                href="/docs/primeiro-form"
                className="hidden lg:inline text-xs text-muted-foreground hover:text-foreground tracking-apple-snug transition-colors px-2"
              >
                Documentação
              </Link>
              <HelpTooltip content="Precisa de ajuda? Confira nossos tutoriais ou entre em contato com suporte@althos.io" />
              <div className="w-px h-4 bg-border mx-1" />
              <PushNotificationToggle orgSlug={params.orgSlug} />
              <NotificationBell orgId={org.id} userId={user.id} />
              <ModeToggle />
            </div>
          </header>

          <main className="flex-1 px-6 py-8 overflow-y-auto bg-secondary/40">
            <div className="mx-auto w-full max-w-[1400px]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
