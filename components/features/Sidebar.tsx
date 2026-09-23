import { getCurrentOrganization, getUser } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import SidebarNavLink from './SidebarNavLink'
import SidebarShell from './SidebarShell'
import SidebarUserMenu from './SidebarUserMenu'
import { SidebarOrgSwitcher } from './SidebarOrgSwitcher'
import { SidebarBrandSignature } from './SidebarBrandSignature'
import { canAccess, type Permissions, type MemberRole } from '@/lib/permissions'
import { getObjectSignedUrl } from '@/actions/storage'
import { checkFeatureAccess } from '@/lib/plans/server'
import { deriveInitials } from '@/lib/organization/initials'
import { LayoutDashboard, Wallet, FileText } from 'lucide-react'
import { SidebarNavVendas } from './SidebarNavVendas'
import { SidebarNavExtra } from './SidebarNavExtra'

/** Non-interactive section divider label. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pt-4 pb-1 text-[10px] uppercase tracking-[0.06em] font-bold text-sidebar-foreground/45 select-none">
      {children}
    </p>
  )
}

export default async function Sidebar({ orgSlug }: { orgSlug: string }) {
  const supabase = createClient()

  // org (memoizada) + user (memoizado) em paralelo — sem cascata.
  const [org, user] = await Promise.all([
    getCurrentOrganization(orgSlug),
    getUser(),
  ])

  const userName  = (user?.user_metadata?.name  as string) ?? ''
  const userEmail = user?.email ?? ''
  const avatarObjectId = user?.user_metadata?.avatar_storage_object_id as string | undefined
  let userAvatarUrl: string | null = (user?.user_metadata?.avatar_url as string) ?? null
  if (avatarObjectId) {
    const signed = await getObjectSignedUrl(orgSlug, avatarObjectId)
    if (signed.ok) userAvatarUrl = signed.url
  }

  const accountId = (org as any).account_id as string | null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Todas as queries do sidebar dependem só de org/user (já resolvidos), então
  // disparam JUNTAS em vez de em cascata: membership, tarefas vencidas,
  // conversas não lidas e os 3 checks de plano. Colapsa ~5 round-trips em 1 fase.
  const [membershipRes, overdueRes, convsRes, socialConvsRes, planChecks, orgsRes] = await Promise.all([
    user
      ? supabase
          .from('memberships')
          .select('role, permissions')
          .eq('organization_id', org.id)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .eq('status', 'open')
      .lt('due_date', today.toISOString()),
    supabase
      .from('whatsapp_conversations')
      .select('unread_count')
      .eq('organization_id', org.id),
    supabase
      .from('social_conversations')
      .select('unread_count')
      .eq('organization_id', org.id),
    // Plan entitlements (per account). Super-admins bypass in SQL, so the owner
    // always sees everything. If the org has no account (legacy), don't hide —
    // server actions still enforce the gate. Permission gating (can()) still
    // applies on top of this.
    accountId
      ? Promise.all([
          checkFeatureAccess(accountId, 'ai_insights'),
          checkFeatureAccess(accountId, 'export_reports'),
          checkFeatureAccess(accountId, 'whatsapp'),
          checkFeatureAccess(accountId, 'instagram_automation'),
          checkFeatureAccess(accountId, 'bulk_campaigns'),
        ])
      : Promise.resolve<[boolean, boolean, boolean, boolean, boolean]>([true, true, true, true, true]),
    // Organizações do usuário (seletor no topo da sidebar, #10/#30) — filtra
    // por user.id explicitamente pelo mesmo motivo do antigo switcher no
    // header: super-admins não devem ver todas as orgs via RLS de super-admin.
    user
      ? supabase.from('memberships').select('organizations(id, name, slug)').eq('user_id', user.id)
      : Promise.resolve({ data: null }),
  ])

  // Membership → role + permissions
  let userRole:        MemberRole  = 'member'
  let userPermissions: Permissions = {}
  let isOwnerOrAdmin = false
  const membership = (membershipRes as { data: { role: string; permissions: Permissions } | null }).data
  if (membership) {
    userRole        = membership.role as MemberRole
    userPermissions = (membership.permissions ?? {}) as Permissions
    isOwnerOrAdmin  = userRole === 'owner' || userRole === 'admin'
  }

  // Helper to decide visibility
  function can(key: Parameters<typeof canAccess>[2]) {
    return canAccess(userRole, userPermissions, key)
  }

  const [, planReports, planWhatsapp, planInstagram, planBulkCampaigns] = planChecks as [boolean, boolean, boolean, boolean, boolean]

  const overdueCount = (overdueRes as { count: number | null }).count
  const convs = (convsRes as { data: { unread_count: number }[] | null }).data
  const unreadWhatsapp = convs?.reduce((a, b) => a + (b.unread_count || 0), 0) || 0
  const socialConvs = (socialConvsRes as { data: { unread_count: number }[] | null }).data
  const unreadInstagram = socialConvs?.reduce((a, b) => a + (b.unread_count || 0), 0) || 0

  const base = `/app/${orgSlug}`

  const orgsData = (orgsRes as { data: { organizations: unknown }[] | null }).data
  const orgs: { id: string; name: string; slug: string }[] =
    orgsData?.flatMap(m => {
      const o = m.organizations as any
      if (!o) return []
      return Array.isArray(o) ? o : [o]
    }) || []

  return (
    <SidebarShell>
      {/* Seletor de organização no topo (issue #10) — reflete o contrato de
          #30. Renderiza em desktop (aside) E no drawer mobile (mesmo JSX,
          via SidebarShell) — a versão anterior escondia isto com
          `hidden md:block` e, como o switcher antigo do header também foi
          removido, usuários mobile com mais de uma org ficavam sem
          NENHUMA forma de trocar (achado da revisão automática da PR #35).
          O cabeçalho do drawer (logo + X) continua fixo acima disto. */}
      <div className="px-3 pt-3">
        <SidebarOrgSwitcher
          currentSlug={orgSlug}
          currentName={org.name}
          currentInitials={deriveInitials(org.name)}
          currentLogoUrl={(org as any).logo_url ?? null}
          organizations={orgs}
          canManage={isOwnerOrAdmin}
        />
      </div>
      <nav className="sidebar-scroll flex-1 min-h-0 px-3 pt-3 pb-4 space-y-0.5 overflow-y-auto">

        {/* ── Topo ──────────────────────────────────── */}
        <SidebarNavLink href={base} exact dataTour="insights">
          <span className="flex items-center gap-2.5">
            <LayoutDashboard className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Dashboards</span>
          </span>
        </SidebarNavLink>

        {can('financial') && (
          <SidebarNavLink href={`${base}/financeiro`}>
            <span className="flex items-center gap-2.5">
              <Wallet className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Financeiro</span>
            </span>
          </SidebarNavLink>
        )}

        {isOwnerOrAdmin && planReports && (
          <SidebarNavLink href={`${base}/relatorios`}>
            <span className="flex items-center gap-2.5">
              <FileText className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Relatórios</span>
            </span>
          </SidebarNavLink>
        )}

        {/* ── Vendas ────────────────────────────────── */}
        <SectionLabel>Vendas</SectionLabel>

        <SidebarNavVendas
          base={base}
          niche={org.niche}
          userRole={userRole}
          userPermissions={userPermissions}
          overdueCount={overdueCount}
        />

        <SidebarNavExtra
          base={base}
          orgSlug={orgSlug}
          orgId={org.id}
          niche={org.niche}
          userRole={userRole}
          userPermissions={userPermissions}
          planWhatsapp={planWhatsapp}
          planInstagram={planInstagram}
          planBulkCampaigns={planBulkCampaigns}
          unreadWhatsapp={unreadWhatsapp}
          unreadInstagram={unreadInstagram}
        />

      </nav>

      {/* Assinatura "Althos CRM" (issue #10) — só desktop; o drawer mobile
          já mostra a marca no seu próprio cabeçalho (SidebarShell). */}
      <div className="hidden md:block border-t border-sidebar-border">
        <SidebarBrandSignature />
      </div>

      {/* Menu do usuário: no header (canto direito) na versão desktop —
          ver HeaderUserMenu.tsx em app/app/[orgSlug]/layout.tsx. Aqui na
          sidebar fica só pro drawer mobile por enquanto (md:hidden — o
          mesmo JSX é renderizado tanto no <aside> desktop quanto no
          drawer mobile por SidebarShell.tsx, então essa é a forma de
          escondê-lo só num dos dois). */}
      <div className="p-3 border-t border-sidebar-border md:hidden">
        <SidebarUserMenu name={userName} email={userEmail} avatarUrl={userAvatarUrl} isOwner={userRole === 'owner'} />
      </div>
    </SidebarShell>
  )
}
