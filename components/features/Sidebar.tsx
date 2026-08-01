import { Badge } from '@/components/ui/badge'
import { Logo } from '@/components/brand/Logo'
import { getCurrentOrganization, getUser } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import SidebarUnreadBadge from './SidebarUnreadBadge'
import SidebarNavLink from './SidebarNavLink'
import SidebarShell from './SidebarShell'
import SidebarCollapseToggleButton from './SidebarCollapseToggleButton'
import SidebarUserMenu from './SidebarUserMenu'
import BottomNav from './BottomNav'
import { canAccess, type Permissions, type MemberRole } from '@/lib/permissions'
import { isTravelNiche } from '@/lib/niche'
import { checkFeatureAccess } from '@/lib/plans/server'
import {
  LayoutDashboard,
  Kanban,
  Users,
  CheckSquare,
  FileText,
  Package,
  ShoppingCart,
  MessageSquare,
  Zap,
  Settings,
  Calendar,
  Megaphone,
  FileSignature,
  PlaneTakeoff,
  Store,
  CalendarClock,
  Wallet,
  FileStack,
  Armchair,
} from 'lucide-react'

/** Non-interactive section divider label. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pt-4 pb-1 text-[10px] uppercase tracking-[0.06em] font-bold text-muted-foreground select-none">
      {children}
    </p>
  )
}

/** lucide-react não tem ícone de Instagram — SVG inline no mesmo estilo dos demais. */
function IgIcon() {
  return (
    <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
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
        ])
      : Promise.resolve<[boolean, boolean, boolean, boolean]>([true, true, true, true]),
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

  const [, planReports, planWhatsapp, planInstagram] = planChecks as [boolean, boolean, boolean, boolean]

  const overdueCount = (overdueRes as { count: number | null }).count
  const convs = (convsRes as { data: { unread_count: number }[] | null }).data
  const unreadWhatsapp = convs?.reduce((a, b) => a + (b.unread_count || 0), 0) || 0
  const socialConvs = (socialConvsRes as { data: { unread_count: number }[] | null }).data
  const unreadInstagram = socialConvs?.reduce((a, b) => a + (b.unread_count || 0), 0) || 0

  const base = `/app/${orgSlug}`

  return (
    <>
    <SidebarShell>
      {/* Desktop-only — a versão mobile do cabeçalho (logo + nome + X) é
          renderizada direto pelo SidebarShell, pra não duplicar quando o
          drawer mobile monta este mesmo children pela segunda vez. */}
      <div className="hidden md:flex h-14 border-b border-sidebar-border items-center justify-between px-5 relative">
        <Logo className="sidebar-brand" />
        <div className="sidebar-toggle-btn shrink-0">
          <SidebarCollapseToggleButton />
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">

        {/* ── Topo ──────────────────────────────────── */}
        <SidebarNavLink href={base} exact dataTour="insights">
          <span className="flex items-center gap-2.5">
            <LayoutDashboard className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Inicial</span>
          </span>
        </SidebarNavLink>

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

        {can('pipeline') && (
          <SidebarNavLink href={`${base}/pipeline`} dataTour="pipeline">
            <span className="flex items-center gap-2.5">
              <Kanban className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Pipeline</span>
            </span>
          </SidebarNavLink>
        )}

        {(can('leads') || can('clients')) && (
          <SidebarNavLink href={`${base}/contatos`} dataTour="leads">
            <span className="flex items-center gap-2.5">
              <Users className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Contatos</span>
            </span>
          </SidebarNavLink>
        )}

        {can('tasks') && (
          <SidebarNavLink href={`${base}/tarefas`}>
            <span className="flex items-center gap-2.5">
              <CheckSquare className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Tarefas</span>
              {!!overdueCount && overdueCount > 0 && (
                <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1.5 py-0 leading-none">
                  {overdueCount}
                </Badge>
              )}
            </span>
          </SidebarNavLink>
        )}

        {can('cotacoes') && isTravelNiche(org.niche) && (
          <SidebarNavLink href={`${base}/cotacoes`}>
            <span className="flex items-center gap-2.5">
              <FileSignature className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Cotações</span>
            </span>
          </SidebarNavLink>
        )}

        {can('explorar_voos') && isTravelNiche(org.niche) && (
          <a
            href="https://www.google.com/travel/explore"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-2 text-sm font-medium tracking-apple-snug rounded-lg transition-colors duration-150 ease-apple text-sky-600 hover:text-sky-700 hover:bg-sky-500/10 dark:text-sky-400 dark:hover:text-sky-300"
          >
            <span className="flex items-center gap-2.5">
              <span className="w-[18px] h-[18px] shrink-0 text-center leading-[18px]" aria-hidden="true">✈️</span>
              <span>Explorar Voos</span>
            </span>
          </a>
        )}

        {can('ofertas') && isTravelNiche(org.niche) && (
          <SidebarNavLink href={`${base}/ofertas`}>
            <span className="flex items-center gap-2.5">
              <Store className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Ofertas</span>
            </span>
          </SidebarNavLink>
        )}

        {can('embarques') && isTravelNiche(org.niche) && (
          <SidebarNavLink href={`${base}/embarques`}>
            <span className="flex items-center gap-2.5">
              <CalendarClock className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Embarques</span>
            </span>
          </SidebarNavLink>
        )}

        {can('bloqueios') && isTravelNiche(org.niche) && (
          <SidebarNavLink href={`${base}/bloqueios`}>
            <span className="flex items-center gap-2.5">
              <Armchair className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Bloqueios</span>
            </span>
          </SidebarNavLink>
        )}

        {can('catalog') && !isTravelNiche(org.niche) && (
          <SidebarNavLink href={`${base}/catalogo`}>
            <span className="flex items-center gap-2.5">
              <Package className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Catálogo</span>
            </span>
          </SidebarNavLink>
        )}

        {can('sales') && !isTravelNiche(org.niche) && (
          <SidebarNavLink href={`${base}/vendas`}>
            <span className="flex items-center gap-2.5">
              <ShoppingCart className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Vendas</span>
            </span>
          </SidebarNavLink>
        )}

        {can('reservas') && isTravelNiche(org.niche) && (
          <SidebarNavLink href={`${base}/reservas`}>
            <span className="flex items-center gap-2.5">
              <PlaneTakeoff className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Reservas</span>
            </span>
          </SidebarNavLink>
        )}

        {can('documentos') && isTravelNiche(org.niche) && (
          <SidebarNavLink href={`${base}/documentos`}>
            <span className="flex items-center gap-2.5">
              <FileStack className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Documentos</span>
            </span>
          </SidebarNavLink>
        )}

        {can('calendar') && !isTravelNiche(org.niche) && (
          <SidebarNavLink href={`${base}/agendamentos`} dataTour="agendamentos">
            <span className="flex items-center gap-2.5">
              <Calendar className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Agendamentos</span>
            </span>
          </SidebarNavLink>
        )}

        {/* ── Comunicação ───────────────────────────── */}
        <SectionLabel>Comunicação</SectionLabel>

        {can('conversations') && planWhatsapp && (
          <SidebarNavLink href={`${base}/conversas`}>
            <span className="flex items-center gap-2.5">
              <MessageSquare className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Conversas</span>
              <SidebarUnreadBadge orgId={org.id} initialCount={unreadWhatsapp} />
            </span>
          </SidebarNavLink>
        )}

        {can('social') && planInstagram && (
          <SidebarNavLink href={`${base}/social`}>
            <span className="flex items-center gap-2.5">
              <IgIcon />
              <span>Instagram</span>
              <SidebarUnreadBadge orgId={org.id} initialCount={unreadInstagram} table="social_conversations" />
            </span>
          </SidebarNavLink>
        )}

        {/* ── Marketing ─────────────────────────────── */}
        <SectionLabel>Marketing</SectionLabel>

        {can('marketing') && (
          <>
            <SidebarNavLink href={`${base}/marketing`} exact dataTour="forms">
              <span className="flex items-center gap-2.5">
                <Megaphone className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
                <span>Anúncios</span>
              </span>
            </SidebarNavLink>
          </>
        )}

        {can('forms') && (
          <SidebarNavLink href={`${base}/forms`}>
            <span className="flex items-center gap-2.5">
              <FileText className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Formulários</span>
            </span>
          </SidebarNavLink>
        )}

        {/* ── Operações ─────────────────────────────── */}
        <SectionLabel>Operações</SectionLabel>

        {can('financial') && (
          <SidebarNavLink href={`${base}/financeiro`}>
            <span className="flex items-center gap-2.5">
              <Wallet className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Financeiro</span>
            </span>
          </SidebarNavLink>
        )}

        {can('automations') && (
          <SidebarNavLink href={`${base}/automacoes`}>
            <span className="flex items-center gap-2.5">
              <Zap className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Automações</span>
            </span>
          </SidebarNavLink>
        )}

        {/* ── Configurações ─────────────────────────── */}
        {can('settings') && (
          <>
            <SectionLabel>Configurações</SectionLabel>

            <SidebarNavLink href={`${base}/configuracoes`} exact>
              <span className="flex items-center gap-2.5">
                <Settings className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
                <span>Configurações</span>
              </span>
            </SidebarNavLink>
          </>
        )}

      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <SidebarUserMenu name={userName} email={userEmail} />
      </div>
    </SidebarShell>
    <BottomNav
      orgSlug={orgSlug}
      showPipeline={can('pipeline')}
      showContatos={can('leads') || can('clients')}
      showTarefas={can('tasks')}
      showConversas={can('conversations') && planWhatsapp}
      overdueCount={overdueCount ?? 0}
      unreadCount={unreadWhatsapp}
    />
    </>
  )
}
