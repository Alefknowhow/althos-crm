import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import Sidebar from '@/components/features/Sidebar'
import { createClient } from '@/lib/supabase/server'
import ImpersonationBanner from '@/components/features/dashboard/ImpersonationBanner'
import NotificationBell from '@/components/features/NotificationBell'
import { AiCreditsBadge } from '@/components/ai-credits-badge'
import OnboardingTour from '@/components/features/OnboardingTour'
import TrialBanner from '@/components/features/billing/TrialBanner'
import { SupportWidget, SupportHeaderButton } from '@/components/features/SupportWidget'
import { isAccessBlocked, getPlan } from '@/lib/billing/plans'
import FrozenBanner from '@/components/features/billing/FrozenBanner'
import { SidebarCollapseProvider } from '@/components/features/SidebarCollapseContext'
import { HeaderMobileMenu } from '@/components/features/HeaderMobileMenu'
import { PageHintProvider } from '@/components/features/PageHintContext'
import { HeaderSidebarToggle } from '@/components/features/HeaderSidebarToggle'
import { HeaderModuleTitle } from '@/components/features/HeaderModuleTitle'
import { GlobalBackButton } from '@/components/features/GlobalBackButton'
import QueryProvider from '@/components/providers/QueryProvider'
import { ShortcutProvider } from '@/components/features/ShortcutProvider'
import CommandPalette from '@/components/features/CommandPalette'
import { HeaderSearchBar } from '@/components/features/HeaderSearchBar'
import HeaderUserMenu from '@/components/features/HeaderUserMenu'
import { getObjectSignedUrl } from '@/actions/storage'
import CopilotDock from '@/components/features/dashboard/CopilotDock'
import { CopilotProvider } from '@/components/features/CopilotProvider'
import OrchestratorPalette from '@/components/features/OrchestratorPalette'
import { canAccess, type Permissions, type MemberRole } from '@/lib/permissions'
import { checkFeatureAccess, getAccountIdForOrgSlug } from '@/lib/plans/server'
import { CallDialerProvider } from '@/components/features/voice/CallDialerModal'
import { SmsComposeProvider } from '@/components/features/voice/SmsComposeModal'
import { ActiveCallProvider } from '@/components/features/voice/ActiveCallProvider'
import { ActiveCallBar } from '@/components/features/voice/ActiveCallBar'
import { MobileBottomNav } from '@/components/features/MobileBottomNav'

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

  // Copiloto IA — botão flutuante presente em toda tela do app (não só no
  // dashboard). Gate pela permissão 'insights'; o plano/créditos é checado
  // por dentro do próprio copiloto (getCopilotInit / rota de chat).
  const { data: membership } = await supabase
    .from('memberships')
    .select('role, permissions')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle()
  const canUseCopilot = membership
    ? canAccess(membership.role as MemberRole, (membership.permissions ?? {}) as Permissions, 'insights')
    : false

  // Althos Voice: gate igual ao do copiloto (permissão + plano) — a barra de
  // chamada ativa e o dialer só montam (e só então emitem token Twilio) se o
  // usuário efetivamente pode usar o módulo.
  const hasVoicePermission = membership
    ? canAccess(membership.role as MemberRole, (membership.permissions ?? {}) as Permissions, 'voice')
    : false
  const voiceAccountId = hasVoicePermission ? await getAccountIdForOrgSlug(params.orgSlug) : null
  const canUseVoice = hasVoicePermission && voiceAccountId ? await checkFeatureAccess(voiceAccountId, 'voice') : false

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
    <CopilotProvider>
    <ActiveCallProvider orgSlug={params.orgSlug} identity={user.id} enabled={canUseVoice}>
    <CallDialerProvider orgSlug={params.orgSlug}>
    <SmsComposeProvider orgSlug={params.orgSlug}>
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background text-foreground font-sans print:static print:h-auto print:overflow-visible print:block">
      <div className="print:hidden">
        {isFrozen ? (
          <FrozenBanner orgSlug={params.orgSlug} />
        ) : (
          <TrialBanner orgId={org.id} orgSlug={params.orgSlug} plan={(org as any).plan ?? null} />
        )}
      </div>
      <OnboardingTour userName={userName} />
      <ImpersonationBanner />
      <ShortcutProvider>
      {/* Diálogo montado uma única vez — os triggers (mobile e desktop) só
          disparam o mesmo toggle global, evitando 2 diálogos concorrentes. */}
      <div className="print:hidden">
        <CommandPalette orgSlug={params.orgSlug} />
        {canUseCopilot && <OrchestratorPalette orgSlug={params.orgSlug} />}
      </div>
      <SidebarCollapseProvider>
      <PageHintProvider>
      {/* Sidebar é fixa (sem opção de recolher) e fica ao lado do header —
          mesmo respiro acima dos dois (pt-2/mt-2), pra alinhar os topos. O
          header começa onde a sidebar termina, não mais atravessando a tela
          inteira. */}
      <div className="flex flex-1 min-h-0 print:block">
        <div className="print:hidden md:pt-2 md:pb-3 md:pl-3 min-h-0">
          <Sidebar orgSlug={params.orgSlug} />
        </div>

        <div className="flex-1 flex flex-col min-w-0 min-h-0 print:block">
          <header className="print:hidden h-12 shrink-0 border border-border bg-card flex items-center px-3 md:px-5 gap-3 justify-between sticky top-2 z-30 mx-3 mt-2 rounded-xl shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <GlobalBackButton orgSlug={params.orgSlug} />
              {/* Mobile: título compacto (inalterado). Desktop: ícone +
                  nome do módulo em destaque. */}
              <div className="md:hidden min-w-0">
                <HeaderSidebarToggle orgSlug={params.orgSlug} />
              </div>
              <div className="hidden md:block min-w-0">
                <HeaderModuleTitle orgSlug={params.orgSlug} />
              </div>
            </div>

            {/* Busca centralizada entre o bloco da esquerda (módulo) e o
                bloco da direita (notificações/suporte/usuário). */}
            <div className="hidden md:flex flex-1 items-center justify-center min-w-0 px-2">
              <HeaderSearchBar orgSlug={params.orgSlug} />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Busca vira exclusiva do desktop — no mobile já tem entrada
                  própria na barra inferior (Consultar), manter no header
                  também duplicava a ação (pedido explícito: remover a
                  duplicidade). Copiloto de IA removido do header (pedido
                  explícito) — continua acessível pelo widget flutuante
                  (CopilotDock) e pela barra inferior mobile. */}
              {/* Push toggle e alternância de tema saíram do header — moveram
                  pro menu do usuário (mesma consolidação do canvas do
                  /design, artboard 05: "só o sino permanece" no header). */}
              <AiCreditsBadge className="hidden sm:inline-flex" hideWhenZeroIncluded />
              <div className="hidden md:block w-px h-[22px] bg-foreground/10 mx-0.5" />
              <NotificationBell orgSlug={params.orgSlug} orgId={org.id} userId={user.id} />
              <div className="hidden md:inline-flex">
                <SupportHeaderButton />
              </div>
              <div className="hidden md:block w-px h-[22px] bg-foreground/10 mx-0.5" />
              <div className="hidden md:inline-flex">
                <HeaderUserMenu orgSlug={params.orgSlug} name={headerUserName} email={user.email ?? ''} avatarUrl={headerAvatarUrl} isOwner={membership?.role === 'owner'} planKey={getPlan((org as any).plan).key} planLabel={getPlan((org as any).plan).label} />
              </div>
              <HeaderMobileMenu orgSlug={params.orgSlug} />
            </div>
          </header>

          <main className="flex-1 flex flex-col min-h-0 px-3 sm:px-5 pt-3 pb-5 overflow-y-auto overflow-x-hidden bg-background print:block print:h-auto print:overflow-visible print:p-0 print:bg-white">
            <div className="mx-auto w-full max-w-[1760px] flex-1 flex flex-col min-h-0 print:block print:max-w-none">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Barra inferior mobile (Resumo/Consultar/Assistente/Módulos) —
          item real do flex column (não fixed/overlay) — ver comentário em
          MobileBottomNav.tsx sobre por que isso evita cobrir conteúdo com
          scroll interno próprio (achado: menu cobrindo Contatos/Tarefas). */}
      <div className="print:hidden">
        <MobileBottomNav orgSlug={params.orgSlug} canUseCopilot={canUseCopilot} />
      </div>

      </PageHintProvider>
      </SidebarCollapseProvider>
      </ShortcutProvider>

      <div className="print:hidden">
        <SupportWidget orgSlug={params.orgSlug} />
        {canUseCopilot && <CopilotDock orgSlug={params.orgSlug} />}
        {canUseVoice && <ActiveCallBar orgSlug={params.orgSlug} />}
      </div>
    </div>
    </SmsComposeProvider>
    </CallDialerProvider>
    </ActiveCallProvider>
    </CopilotProvider>
    </QueryProvider>
  )
}
