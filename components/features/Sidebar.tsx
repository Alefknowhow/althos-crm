import { Logo } from '@/components/brand/Logo'
import { getCurrentOrganization, getUser } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import SidebarNavLink from './SidebarNavLink'
import SidebarShell from './SidebarShell'
import SidebarCollapseToggleButton from './SidebarCollapseToggleButton'
import SidebarUserMenu from './SidebarUserMenu'
import { canAccess, type Permissions, type MemberRole } from '@/lib/permissions'
import { getObjectSignedUrl } from '@/actions/storage'
import { checkFeatureAccess } from '@/lib/plans/server'
import { LayoutDashboard, Wallet, FileText } from 'lucide-react'
import { SidebarNavVendas } from './SidebarNavVendas'
import { SidebarNavExtra } from './SidebarNavExtra'

/** Non-interactive section divider label. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pt-4 pb-1 text-[10px] uppercase tracking-[0.06em] font-bold text-muted-foreground select-none">
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
  const [membershipRes, overdueRes, convsRes, socialConvsRes, planChecks] = await Promise.all([
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

  return (
    <SidebarShell>
      {/* Desktop-only — a versão mobile do cabeçalho (logo + nome + X) é
          renderizada direto pelo SidebarShell, pra não duplicar quando o
          drawer mobile monta este mesmo children pela segunda vez. */}
      <div className="hidden md:flex h-14 border-b border-sidebar-border items-center justify-between px-5 relative">
        <Logo className="sidebar-brand" v2 />
        <div className="sidebar-toggle-btn shrink-0">
          <SidebarCollapseToggleButton />
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">

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

      {/* Menu do usuário: no header (canto direito) na versão desktop —
          ver HeaderUserMenu.tsx em app/app/[orgSlug]/layout.tsx. Aqui na
          sidebar fica só pro drawer mobile por enquanto (md:hidden — o
          mesmo JSX é renderizado tanto no <aside> desktop quanto no
          drawer mobile por SidebarShell.tsx, então essa é a forma de
          escondê-lo só num dos dois). */}
      <div className="p-3 border-t border-sidebar-border md:hidden">
        <SidebarUserMenu name={userName} email={userEmail} avatarUrl={userAvatarUrl} />
      </div>
    </SidebarShell>
  )
}
