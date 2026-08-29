import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import Sidebar from '@/components/features/Sidebar'
import OrganizationSwitcher from '@/components/features/OrganizationSwitcher'
import { createClient } from '@/lib/supabase/server'
import ImpersonationBanner from '@/components/features/dashboard/ImpersonationBanner'
import NotificationBell from '@/components/features/NotificationBell'
import { ModeToggle } from '@/components/features/ModeToggle'
import { AiCreditsBadge } from '@/components/ai-credits-badge'
import OnboardingTour from '@/components/features/OnboardingTour'
import PushNotificationToggle from '@/components/features/PushNotificationToggle'
import TrialBanner from '@/components/features/billing/TrialBanner'
import { SupportWidget, SupportHeaderButton } from '@/components/features/SupportWidget'
import { isAccessBlocked } from '@/lib/billing/plans'
import FrozenBanner from '@/components/features/billing/FrozenBanner'
import { SidebarCollapseProvider } from '@/components/features/SidebarCollapseContext'
import { HeaderMobileMenu } from '@/components/features/HeaderMobileMenu'
import { PageHintProvider } from '@/components/features/PageHintContext'
import { HeaderSidebarToggle } from '@/components/features/HeaderSidebarToggle'
import { HeaderModuleTitle } from '@/components/features/HeaderModuleTitle'
import { GlobalBackButton } from '@/components/features/GlobalBackButton'
import QueryProvider from '@/components/providers/QueryProvider'
import CommandPalette, { CommandPaletteTrigger } from '@/components/features/CommandPalette'
import { HeaderSearchBar } from '@/components/features/HeaderSearchBar'
import HeaderUserMenu from '@/components/features/HeaderUserMenu'
import { getObjectSignedUrl } from '@/actions/storage'

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

  // Avatar do usuário (menu no header, canto direito) — mesmo padrão dos
  // demais avatares migrados pro R2: referência estável em user_metadata,
  // signed URL resolvida na hora de renderizar. Ver actions/profile.ts.
  const headerUserName = (user.user_metadata as any)?.name as string ?? ''
  const avatarObjectId = (user.user_metadata as any)?.avatar_storage_object_id as string | undefined
  let headerAvatarUrl: string | null = (user.user_metadata as any)?.avatar_url ?? null
  if (avatarObjectId) {
    const signed = await getObjectSignedUrl(params.orgSlug, avatarObjectId)
    if (signed.ok) headerAvatarUrl = signed.url
  }

  return (
    <QueryProvider>
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background text-foreground font-plex print:static print:h-auto print:overflow-visible print:block">
      <div className="print:hidden">
        {isFrozen ? (
          <FrozenBanner orgSlug={params.orgSlug} />
        ) : (
          <TrialBanner orgId={org.id} orgSlug={params.orgSlug} plan={(org as any).plan ?? null} />
        )}
      </div>
      <OnboardingTour userName={userName} />
      <ImpersonationBanner />
      {/* Diálogo montado uma única vez — os triggers (mobile e desktop) só
          disparam o mesmo toggle global, evitando 2 diálogos concorrentes. */}
      <div className="print:hidden">
        <CommandPalette orgSlug={params.orgSlug} />
      </div>
      <SidebarCollapseProvider>
      <PageHintProvider>
      <div className="flex flex-1 min-h-0 print:block">
        <div className="print:hidden">
          <Sidebar orgSlug={params.orgSlug} />
        </div>

        <div className="flex-1 flex flex-col min-w-0 min-h-0 print:block">
          {/* pl-14 on mobile leaves space for the fixed sidebar hamburger
              rendered by SidebarShell. md+ uses normal padding since the
              desktop aside occupies its own column. Hidden entirely on
              print so only the page's own content (ex.: DocumentPrintView)
              shows up — nunca a chrome do CRM. */}
          <header className="print:hidden h-14 border-b border-border bg-background flex items-center pl-14 pr-4 md:px-5 gap-2 justify-between sticky top-0 z-30">
            <div className="flex items-center gap-3 min-w-0">
              <GlobalBackButton orgSlug={params.orgSlug} />
              {/* Mobile: título compacto (inalterado). Desktop: ícone +
                  nome do módulo em destaque (reformulação). */}
              <div className="md:hidden min-w-0">
                <HeaderSidebarToggle orgSlug={params.orgSlug} />
              </div>
              <div className="hidden md:block min-w-0">
                <HeaderModuleTitle orgSlug={params.orgSlug} />
              </div>
              {/* Uma org por conta: só mostra o seletor quando há mais de uma. */}
              {orgs.length > 1 && (
                <>
                  <div className="hidden md:block w-px h-4 bg-border" />
                  <span className="hidden md:inline text-sm font-medium tracking-apple-snug text-muted-foreground">
                    Organização
                  </span>
                  <OrganizationSwitcher currentSlug={params.orgSlug} organizations={orgs} />
                </>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Mobile/tablet (<md): botão compacto (inalterado). Desktop
                  (md+): barra de pesquisa global — ambos abrem o mesmo
                  command palette, nunca os dois ao mesmo tempo. */}
              <div className="md:hidden">
                <CommandPaletteTrigger orgSlug={params.orgSlug} />
              </div>
              <HeaderSearchBar />
              <AiCreditsBadge className="hidden sm:inline-flex" hideWhenZeroIncluded />
              <div className="hidden md:block w-px h-4 bg-border mx-1" />
              <div className="hidden md:inline-flex">
                <PushNotificationToggle orgSlug={params.orgSlug} />
              </div>
              <NotificationBell orgSlug={params.orgSlug} orgId={org.id} userId={user.id} />
              <div className="hidden md:block w-px h-4 bg-border mx-1" />
              <div className="hidden md:inline-flex">
                <SupportHeaderButton />
              </div>
              <div className="hidden md:block w-px h-4 bg-border mx-1" />
              <div className="hidden md:inline-flex">
                <ModeToggle />
              </div>
              <div className="hidden md:block w-px h-4 bg-border mx-1" />
              <div className="hidden md:inline-flex">
                <HeaderUserMenu orgSlug={params.orgSlug} name={headerUserName} email={user.email ?? ''} avatarUrl={headerAvatarUrl} />
              </div>
              <HeaderMobileMenu orgSlug={params.orgSlug} />
            </div>
          </header>

          <main className="flex-1 flex flex-col min-h-0 px-3 sm:px-5 pt-3 pb-5 overflow-y-auto overflow-x-hidden bg-secondary/40 print:block print:h-auto print:overflow-visible print:p-0 print:bg-white">
            <div className="mx-auto w-full max-w-[1760px] flex-1 flex flex-col min-h-0 print:block print:max-w-none">
              {children}
            </div>
          </main>
        </div>
      </div>
      </PageHintProvider>
      </SidebarCollapseProvider>

      <div className="print:hidden">
        <SupportWidget orgSlug={params.orgSlug} />
      </div>
    </div>
    </QueryProvider>
  )
}
