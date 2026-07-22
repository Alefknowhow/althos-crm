import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import Sidebar from '@/components/features/Sidebar'
import OrganizationSwitcher from '@/components/features/OrganizationSwitcher'
import { createClient } from '@/lib/supabase/server'
import ImpersonationBanner from '@/components/features/dashboard/ImpersonationBanner'
import NotificationBell from '@/components/features/NotificationBell'
import { ModeToggle } from '@/components/features/ModeToggle'
import { HelpTooltip } from '@/components/ui/help-tooltip'
import { CommandPaletteTrigger } from '@/components/features/CommandPalette'
import { AiCreditsBadge } from '@/components/ai-credits-badge'
import OnboardingTour from '@/components/features/OnboardingTour'
import PushNotificationToggle from '@/components/features/PushNotificationToggle'
import TrialBanner from '@/components/features/billing/TrialBanner'
import { SupportWidget, SupportHeaderButton } from '@/components/features/SupportWidget'
import Link from 'next/link'
import { Activity } from 'lucide-react'
import { isAccessBlocked } from '@/lib/billing/plans'
import FrozenBanner from '@/components/features/billing/FrozenBanner'

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string }
}) {
  // Resolve auth + org in parallel. requireAuth() and getCurrentOrganization()
  // both go through the per-request-cached getUser(), so this is two independent
  // round-trips collapsed into one await instead of running back-to-back.
  const [user, org] = await Promise.all([
    requireAuth(),
    getCurrentOrganization(params.orgSlug),
  ])

  // ── Billing gate ────────────────────────────────────────────────────────────
  // Frozen orgs (expired trial without a paid subscription, or a canceled
  // subscription) are NOT locked out of the app — they keep read access to
  // their data, but every mutating server action refuses via
  // assertOrgWritable() (lib/billing/plans.ts). We just show a persistent
  // banner here instead of the old hard redirect to /upgrade.
  const orgFull = org as any
  const isFrozen = isAccessBlocked({
    plan:                       orgFull.plan ?? null,
    trial_ends_at:              orgFull.trial_ends_at ?? null,
    subscription_status:        orgFull.subscription_status ?? null,
    billing_managed_externally: orgFull.billing_managed_externally ?? null,
  })

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

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground font-plex">
      {isFrozen ? (
        <FrozenBanner orgSlug={params.orgSlug} />
      ) : (
        <TrialBanner orgId={org.id} orgSlug={params.orgSlug} plan={(org as any).plan ?? null} />
      )}
      <OnboardingTour userName={userName} />
      <ImpersonationBanner />
      <div className="flex flex-1 min-h-0">
        <Sidebar orgSlug={params.orgSlug} />

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* pl-14 on mobile leaves space for the fixed sidebar hamburger
              rendered by SidebarShell. md+ uses normal padding since the
              desktop aside occupies its own column. */}
          <header className="h-14 border-b border-border bg-background flex items-center pl-14 pr-4 md:px-5 gap-2 justify-between sticky top-0 z-30">
            <div className="flex items-center gap-3 min-w-0">
              {/* Uma org por conta: só mostra o seletor quando há mais de uma. */}
              {orgs.length > 1 && (
                <>
                  <span className="hidden md:inline text-sm font-medium tracking-apple-snug text-muted-foreground">
                    Organização
                  </span>
                  <OrganizationSwitcher currentSlug={params.orgSlug} organizations={orgs} />
                </>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <CommandPaletteTrigger orgSlug={params.orgSlug} />
              <Link
                href={`/app/${params.orgSlug}/configuracoes/integracoes/saude`}
                aria-label="Saúde das integrações"
                title="Saúde das integrações"
                className="hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-xs transition-colors"
              >
                <Activity className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Saúde</span>
              </Link>
              <AiCreditsBadge className="hidden sm:inline-flex" hideWhenZeroIncluded />
              <Link
                href={`/app/${params.orgSlug}/ajuda`}
                className="hidden lg:inline text-xs text-muted-foreground hover:text-foreground tracking-apple-snug transition-colors px-2"
              >
                Central de Ajuda
              </Link>
              <HelpTooltip content="Precisa de ajuda? Acesse a Central de Ajuda ou use o chat de suporte no ícone de balão aqui na barra." />
              <div className="w-px h-4 bg-border mx-1" />
              <PushNotificationToggle orgSlug={params.orgSlug} />
              <NotificationBell orgSlug={params.orgSlug} orgId={org.id} userId={user.id} />
              <SupportHeaderButton />
              <ModeToggle />
            </div>
          </header>

          <main className="flex-1 px-3 sm:px-5 py-5 overflow-y-auto overflow-x-hidden bg-secondary/40">
            <div className="mx-auto w-full max-w-[1760px]">
              {children}
            </div>
          </main>
        </div>
      </div>

      <SupportWidget orgSlug={params.orgSlug} />
    </div>
  )
}
