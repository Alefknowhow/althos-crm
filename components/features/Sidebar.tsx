import { Badge } from '@/components/ui/badge'
import { Logo } from '@/components/brand/Logo'
import { getCurrentOrganization, getUser } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import SidebarUnreadBadge from './SidebarUnreadBadge'
import SidebarNavLink from './SidebarNavLink'
import SidebarShell from './SidebarShell'
import SidebarCollapseToggleButton from './SidebarCollapseToggleButton'
import SidebarUserMenu from './SidebarUserMenu'
import SidebarSupportLink from './SidebarSupportLink'
import { canAccess, type Permissions, type MemberRole } from '@/lib/permissions'
import { getObjectSignedUrl } from '@/actions/storage'
import { isModuleEnabled } from '@/lib/niche-modules'
import { checkFeatureAccess } from '@/lib/plans/server'
import { TRAVEL_PLANNER_ENABLED } from '@/lib/ai/roteirista'
import {
  LayoutDashboard,
  Kanban,
  Users,
  CheckSquare,
  FileText,
  Package,
  ShoppingCart,
  Zap,
  Settings,
  Calendar,
  Megaphone,
  Send,
  FileSignature,
  PlaneTakeoff,
  Store,
  CalendarClock,
  Wallet,
  FileStack,
  Armchair,
  Sparkles,
  Star,
  Stethoscope,
  ClipboardList,
  ListChecks,
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

function WhatsAppIcon() {
  return (
    <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="#0a84ff">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.92 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.67c2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.42 5.82c0 4.55-3.7 8.25-8.25 8.25a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.4c0-4.55 3.7-8.24 8.25-8.24Zm-4.53 4.6c-.17 0-.44.06-.67.32-.23.25-.87.85-.87 2.08 0 1.22.89 2.4 1.01 2.57.13.17 1.75 2.67 4.25 3.74.59.26 1.06.41 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.28-.25-.13-1.47-.73-1.7-.81-.23-.08-.4-.13-.56.13-.17.25-.64.81-.79.98-.14.17-.29.19-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.12-.14.16-.25.24-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.37-.78-1.87-.2-.49-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01Z" />
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

        {can('cotacoes') && isModuleEnabled(org.niche, 'cotacoes') && (
          <SidebarNavLink href={`${base}/cotacoes`}>
            <span className="flex items-center gap-2.5">
              <FileSignature className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Cotações</span>
            </span>
          </SidebarNavLink>
        )}

        {/* Ocultos no mobile: ferramentas de construção/configuração, sem
            uso real "na rua" — continuam disponíveis no desktop. */}
        {TRAVEL_PLANNER_ENABLED && can('roteirista') && isModuleEnabled(org.niche, 'roteirista') && (
          <div className="hidden md:block">
            <SidebarNavLink href={`${base}/roteirista`}>
              <span className="flex items-center gap-2.5">
                <Sparkles className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
                <span>Travel Planner</span>
              </span>
            </SidebarNavLink>
          </div>
        )}

        {can('ofertas') && isModuleEnabled(org.niche, 'ofertas') && (
          <div className="hidden md:block">
            <SidebarNavLink href={`${base}/ofertas`}>
              <span className="flex items-center gap-2.5">
                <Store className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
                <span>Ofertas</span>
              </span>
            </SidebarNavLink>
          </div>
        )}

        {can('embarques') && isModuleEnabled(org.niche, 'embarques') && (
          <SidebarNavLink href={`${base}/embarques`}>
            <span className="flex items-center gap-2.5">
              <CalendarClock className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Embarques</span>
            </span>
          </SidebarNavLink>
        )}

        {can('bloqueios') && isModuleEnabled(org.niche, 'bloqueios') && (
          <SidebarNavLink href={`${base}/bloqueios`}>
            <span className="flex items-center gap-2.5">
              <Armchair className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Bloqueios</span>
            </span>
          </SidebarNavLink>
        )}

        {can('catalog') && isModuleEnabled(org.niche, 'catalogo') && (
          <div className="hidden md:block">
            <SidebarNavLink href={`${base}/catalogo`}>
              <span className="flex items-center gap-2.5">
                <Package className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
                <span>Catálogo</span>
              </span>
            </SidebarNavLink>
          </div>
        )}

        {can('sales') && isModuleEnabled(org.niche, 'vendas') && (
          <SidebarNavLink href={`${base}/vendas`}>
            <span className="flex items-center gap-2.5">
              <ShoppingCart className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Vendas</span>
            </span>
          </SidebarNavLink>
        )}

        {can('reservas') && isModuleEnabled(org.niche, 'reservas') && (
          <SidebarNavLink href={`${base}/reservas`}>
            <span className="flex items-center gap-2.5">
              <PlaneTakeoff className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Reservas</span>
            </span>
          </SidebarNavLink>
        )}

        {can('documentos') && isModuleEnabled(org.niche, 'documentos_viagem') && (
          <div className="hidden md:block">
            <SidebarNavLink href={`${base}/documentos`}>
              <span className="flex items-center gap-2.5">
                <FileStack className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
                <span>Documentos</span>
              </span>
            </SidebarNavLink>
          </div>
        )}

        {can('calendar') && isModuleEnabled(org.niche, 'agendamentos') && (
          <SidebarNavLink href={`${base}/agendamentos`} dataTour="agendamentos">
            <span className="flex items-center gap-2.5">
              <Calendar className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Agendamentos</span>
            </span>
          </SidebarNavLink>
        )}

        {can('profissionais') && isModuleEnabled(org.niche, 'profissionais') && (
          <SidebarNavLink href={`${base}/profissionais`}>
            <span className="flex items-center gap-2.5">
              <Stethoscope className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Profissionais</span>
            </span>
          </SidebarNavLink>
        )}

        {can('orcamentos_clinica') && isModuleEnabled(org.niche, 'orcamentos_clinica') && (
          <SidebarNavLink href={`${base}/orcamentos`}>
            <span className="flex items-center gap-2.5">
              <FileSignature className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Orçamentos</span>
            </span>
          </SidebarNavLink>
        )}

        {can('atendimentos_clinica') && isModuleEnabled(org.niche, 'atendimentos_clinica') && (
          <SidebarNavLink href={`${base}/atendimentos`}>
            <span className="flex items-center gap-2.5">
              <ClipboardList className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Atendimentos</span>
            </span>
          </SidebarNavLink>
        )}

        {can('tratamentos_clinica') && isModuleEnabled(org.niche, 'tratamentos_clinica') && (
          <SidebarNavLink href={`${base}/tratamentos`}>
            <span className="flex items-center gap-2.5">
              <ListChecks className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Tratamentos</span>
            </span>
          </SidebarNavLink>
        )}

        {/* ── Comunicação ───────────────────────────── */}
        <SectionLabel>Comunicação</SectionLabel>

        {can('conversations') && planWhatsapp && (
          <SidebarNavLink href={`${base}/conversas`}>
            <span className="flex items-center gap-2.5">
              <WhatsAppIcon />
              <span>WhatsApp</span>
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

        {can('campaigns') && planBulkCampaigns && (
          <div className="hidden md:block">
            <SidebarNavLink href={`${base}/campanhas`}>
              <span className="flex items-center gap-2.5">
                <Send className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
                <span>Campanhas de Envio</span>
              </span>
            </SidebarNavLink>
          </div>
        )}

        {/* ── Marketing ─────────────────────────────── */}
        {/* Rótulo também some no mobile — os dois itens da seção (Anúncios,
            Formulários) ficam ocultos ali, não faz sentido um cabeçalho vazio. */}
        <div className="hidden md:block">
          <SectionLabel>Marketing</SectionLabel>
        </div>

        {can('marketing') && (
          <div className="hidden md:block">
            <SidebarNavLink href={`${base}/marketing`} exact dataTour="forms">
              <span className="flex items-center gap-2.5">
                <Megaphone className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
                <span>Anúncios</span>
              </span>
            </SidebarNavLink>
          </div>
        )}

        {can('marketing') && (
          <div className="hidden md:block">
            <SidebarNavLink href={`${base}/avaliacoes`}>
              <span className="flex items-center gap-2.5">
                <Star className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
                <span>Avaliações</span>
              </span>
            </SidebarNavLink>
          </div>
        )}

        {can('forms') && (
          <div className="hidden md:block">
            <SidebarNavLink href={`${base}/forms`}>
              <span className="flex items-center gap-2.5">
                <FileText className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
                <span>Formulários</span>
              </span>
            </SidebarNavLink>
          </div>
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
          <div className="hidden md:block">
            <SidebarNavLink href={`${base}/automacoes`}>
              <span className="flex items-center gap-2.5">
                <Zap className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
                <span>Automações</span>
              </span>
            </SidebarNavLink>
          </div>
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

        {/* ── Suporte ────────────────────────────────── */}
        <SectionLabel>Suporte</SectionLabel>
        <SidebarSupportLink orgSlug={orgSlug} />

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
