import { Badge } from '@/components/ui/badge'
import { Logo } from '@/components/brand/Logo'
import { getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import SidebarUnreadBadge from './SidebarUnreadBadge'
import SidebarNavLink from './SidebarNavLink'
import SidebarNavGroup from './SidebarNavGroup'
import SidebarShell from './SidebarShell'
import SidebarUserMenu from './SidebarUserMenu'
import { canAccess, type Permissions, type MemberRole } from '@/lib/permissions'
import { isTravelNiche } from '@/lib/niche'
import { checkFeatureAccess } from '@/lib/plans/server'
import {
  LayoutDashboard,
  Kanban,
  Users,
  UserCheck,
  CheckSquare,
  FileText,
  Package,
  ShoppingCart,
  Mail,
  MessageSquare,
  Zap,
  Settings,
  Calendar,
  Megaphone,
  Bot,
  Sparkles,
  Share2,
  Upload,
  Building2,
  FileSignature,
  PlaneTakeoff,
  Store,
  CalendarClock,
} from 'lucide-react'

/** Non-interactive section divider label. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pt-4 pb-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/50 select-none">
      {children}
    </p>
  )
}

export default async function Sidebar({ orgSlug }: { orgSlug: string }) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const userName  = (user?.user_metadata?.name  as string) ?? ''
  const userEmail = user?.email ?? ''

  // Fetch current user's membership to know their role + permissions
  let userRole:        MemberRole  = 'member'
  let userPermissions: Permissions = {}
  let isOwnerOrAdmin = false

  if (user) {
    const { data: membership } = await supabase
      .from('memberships')
      .select('role, permissions')
      .eq('organization_id', org.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membership) {
      userRole        = membership.role as MemberRole
      userPermissions = (membership.permissions ?? {}) as Permissions
      isOwnerOrAdmin  = userRole === 'owner' || userRole === 'admin'
    }
  }

  // Helper to decide visibility
  function can(key: Parameters<typeof canAccess>[2]) {
    return canAccess(userRole, userPermissions, key)
  }

  // Plan entitlements (per account). Super-admins bypass in SQL, so the owner
  // always sees everything. If the org has no account (legacy), don't hide —
  // server actions still enforce the gate. Permission gating (can()) still
  // applies on top of this.
  const accountId = (org as any).account_id as string | null
  const [planInsights, planAttendant, planReports] = accountId
    ? await Promise.all([
        checkFeatureAccess(accountId, 'ai_insights'),
        checkFeatureAccess(accountId, 'ai_attendant'),
        checkFeatureAccess(accountId, 'export_reports'),
      ])
    : [true, true, true]

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { count: overdueCount } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', org.id)
    .eq('status', 'open')
    .lt('due_date', today.toISOString())

  const { data: convs } = await supabase
    .from('whatsapp_conversations')
    .select('unread_count')
    .eq('organization_id', org.id)
  const unreadWhatsapp = convs?.reduce((a, b) => a + (b.unread_count || 0), 0) || 0

  const base = `/app/${orgSlug}`

  return (
    <SidebarShell>
      <div className="h-14 border-b border-sidebar-border flex items-center px-5">
        <Logo className="sidebar-brand" />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">

        {/* ── Topo ──────────────────────────────────── */}
        <SidebarNavLink href={base} exact>
          <span className="flex items-center gap-2.5">
            <LayoutDashboard className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Dashboard</span>
          </span>
        </SidebarNavLink>

        {can('insights') && planInsights && (
          <SidebarNavLink href={`${base}/insights`} dataTour="insights">
            <span className="flex items-center gap-2.5">
              <Sparkles className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Insights IA</span>
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

        {can('pipeline') && (
          <SidebarNavLink href={`${base}/pipeline`} dataTour="pipeline">
            <span className="flex items-center gap-2.5">
              <Kanban className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Pipeline</span>
            </span>
          </SidebarNavLink>
        )}

        {can('leads') && (
          <SidebarNavLink href={`${base}/leads`} dataTour="leads">
            <span className="flex items-center gap-2.5">
              <Users className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Leads</span>
            </span>
          </SidebarNavLink>
        )}

        {can('clients') && (
          <SidebarNavLink href={`${base}/clientes`}>
            <span className="flex items-center gap-2.5">
              <UserCheck className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Clientes</span>
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

        {can('sales') && isTravelNiche(org.niche) && (
          <SidebarNavLink href={`${base}/proposta`}>
            <span className="flex items-center gap-2.5">
              <FileSignature className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Cotações</span>
            </span>
          </SidebarNavLink>
        )}

        {can('sales') && isTravelNiche(org.niche) && (
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

        {can('sales') && isTravelNiche(org.niche) && (
          <SidebarNavLink href={`${base}/vitrine`}>
            <span className="flex items-center gap-2.5">
              <Store className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Ofertas</span>
            </span>
          </SidebarNavLink>
        )}

        {can('sales') && isTravelNiche(org.niche) && (
          <SidebarNavLink href={`${base}/viagens-programadas`}>
            <span className="flex items-center gap-2.5">
              <CalendarClock className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Embarques</span>
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

        {can('sales') && isTravelNiche(org.niche) && (
          <SidebarNavLink href={`${base}/vendas-viagem`}>
            <span className="flex items-center gap-2.5">
              <PlaneTakeoff className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Reservas</span>
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

        {can('conversations') && (
          <SidebarNavLink href={`${base}/conversas`}>
            <span className="flex items-center gap-2.5">
              <MessageSquare className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Conversas</span>
              <SidebarUnreadBadge orgId={org.id} initialCount={unreadWhatsapp} />
            </span>
          </SidebarNavLink>
        )}

        {can('social') && (
          <SidebarNavLink href={`${base}/social`}>
            <span className="flex items-center gap-2.5">
              <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/>
              </svg>
              <span>Social · DMs</span>
            </span>
          </SidebarNavLink>
        )}

        {planAttendant && (
          <SidebarNavGroup
            label="Atendente IA"
            icon={<Bot className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />}
            items={[
              { name: 'Playground', href: `${base}/atendente-ia/teste` },
              { name: 'Configurar',  href: `${base}/configuracoes/atendente-ia` },
            ]}
          />
        )}

        {/* ── Marketing ─────────────────────────────── */}
        <SectionLabel>Marketing</SectionLabel>

        {can('marketing') && (
          <>
            <SidebarNavLink href={`${base}/marketing`} exact dataTour="forms">
              <span className="flex items-center gap-2.5">
                <Megaphone className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
                <span>Campanhas</span>
              </span>
            </SidebarNavLink>

            <SidebarNavLink href={`${base}/marketing/contas`}>
              <span className="flex items-center gap-2.5">
                <Building2 className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
                <span>Contas</span>
              </span>
            </SidebarNavLink>

            <SidebarNavLink href={`${base}/marketing/importar`}>
              <span className="flex items-center gap-2.5">
                <Upload className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
                <span>Importar</span>
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

        {isOwnerOrAdmin && (
          <SidebarNavLink href={`${base}/configuracoes/meta`}>
            <span className="flex items-center gap-2.5">
              <Share2 className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Meta / Pixel</span>
            </span>
          </SidebarNavLink>
        )}

        {/* ── Operações ─────────────────────────────── */}
        <SectionLabel>Operações</SectionLabel>

        {can('automations') && (
          <SidebarNavLink href={`${base}/automacoes`}>
            <span className="flex items-center gap-2.5">
              <Zap className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Automações</span>
            </span>
          </SidebarNavLink>
        )}

        {can('templates') && (
          <>
            <SidebarNavLink href={`${base}/email-templates`}>
              <span className="flex items-center gap-2.5">
                <Mail className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
                <span>Templates</span>
              </span>
            </SidebarNavLink>

            <SidebarNavLink href={`${base}/whatsapp-templates`}>
              <span className="flex items-center gap-2.5">
                <MessageSquare className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
                <span>Templates WA</span>
              </span>
            </SidebarNavLink>
          </>
        )}

        {/* ── Configurações ─────────────────────────── */}
        {can('settings') && (
          <>
            <SectionLabel>Configurações</SectionLabel>

            <SidebarNavLink href={`${base}/configuracoes`} exact>
              <span className="flex items-center gap-2.5">
                <Settings className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
                <span>Geral</span>
              </span>
            </SidebarNavLink>
          </>
        )}

      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <SidebarUserMenu name={userName} email={userEmail} />
      </div>
    </SidebarShell>
  )
}
