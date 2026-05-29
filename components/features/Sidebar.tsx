import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import SidebarUnreadBadge from './SidebarUnreadBadge'
import SidebarNavLink from './SidebarNavLink'
import SidebarNavGroup from './SidebarNavGroup'
import SidebarShell from './SidebarShell'
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
  LogOut,
  Calendar,
  Megaphone,
  Bot,
  Sparkles,
  Share2,
  Upload,
  Building2,
  CreditCard,
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
        <span className="font-semibold tracking-apple-tighter text-base">Althos CRM</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">

        {/* ── Topo ──────────────────────────────────── */}
        <SidebarNavLink href={base} exact>
          <span className="flex items-center gap-2.5">
            <LayoutDashboard className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Dashboard</span>
          </span>
        </SidebarNavLink>

        <SidebarNavLink href={`${base}/insights`} dataTour="insights">
          <span className="flex items-center gap-2.5">
            <Sparkles className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Insights IA</span>
          </span>
        </SidebarNavLink>

        {/* ── Vendas ────────────────────────────────── */}
        <SectionLabel>Vendas</SectionLabel>

        <SidebarNavLink href={`${base}/pipeline`} dataTour="pipeline">
          <span className="flex items-center gap-2.5">
            <Kanban className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Pipeline</span>
          </span>
        </SidebarNavLink>

        <SidebarNavLink href={`${base}/leads`} dataTour="leads">
          <span className="flex items-center gap-2.5">
            <Users className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Leads</span>
          </span>
        </SidebarNavLink>

        <SidebarNavLink href={`${base}/clientes`}>
          <span className="flex items-center gap-2.5">
            <UserCheck className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Clientes</span>
          </span>
        </SidebarNavLink>

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

        <SidebarNavLink href={`${base}/catalogo`}>
          <span className="flex items-center gap-2.5">
            <Package className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Catálogo</span>
          </span>
        </SidebarNavLink>

        <SidebarNavLink href={`${base}/vendas`}>
          <span className="flex items-center gap-2.5">
            <ShoppingCart className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Vendas</span>
          </span>
        </SidebarNavLink>

        <SidebarNavLink href={`${base}/agendamentos`} dataTour="agendamentos">
          <span className="flex items-center gap-2.5">
            <Calendar className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Agendamentos</span>
          </span>
        </SidebarNavLink>

        {/* ── Comunicação ───────────────────────────── */}
        <SectionLabel>Comunicação</SectionLabel>

        <SidebarNavLink href={`${base}/conversas`}>
          <span className="flex items-center gap-2.5">
            <MessageSquare className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Conversas</span>
            <SidebarUnreadBadge orgId={org.id} initialCount={unreadWhatsapp} />
          </span>
        </SidebarNavLink>

        <SidebarNavGroup
          label="Atendente IA"
          icon={<Bot className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />}
          items={[
            { name: 'Playground', href: `${base}/atendente-ia/teste` },
            { name: 'Configurar',  href: `${base}/configuracoes/atendente-ia` },
          ]}
        />

        {/* ── Marketing ─────────────────────────────── */}
        <SectionLabel>Marketing</SectionLabel>

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

        <SidebarNavLink href={`${base}/forms`}>
          <span className="flex items-center gap-2.5">
            <FileText className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Formulários</span>
          </span>
        </SidebarNavLink>

        <SidebarNavLink href={`${base}/configuracoes/meta`}>
          <span className="flex items-center gap-2.5">
            <Share2 className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Meta / Pixel</span>
          </span>
        </SidebarNavLink>

        {/* ── Operações ─────────────────────────────── */}
        <SectionLabel>Operações</SectionLabel>

        <SidebarNavLink href={`${base}/automacoes`}>
          <span className="flex items-center gap-2.5">
            <Zap className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Automações</span>
          </span>
        </SidebarNavLink>

        <SidebarNavLink href={`${base}/email-templates`}>
          <span className="flex items-center gap-2.5">
            <Mail className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Templates</span>
          </span>
        </SidebarNavLink>

        {/* ── Configurações ─────────────────────────── */}
        <SectionLabel>Configurações</SectionLabel>

        <SidebarNavLink href={`${base}/configuracoes`} exact>
          <span className="flex items-center gap-2.5">
            <Settings className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Geral</span>
          </span>
        </SidebarNavLink>

        <SidebarNavLink href={`${base}/configuracoes/assinatura`}>
          <span className="flex items-center gap-2.5">
            <CreditCard className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Assinatura</span>
          </span>
        </SidebarNavLink>

      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <form
          action={async () => {
            'use server'
            const { logout } = await import('@/actions/auth')
            await logout()
          }}
        >
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-medium"
          >
            <LogOut className="w-4 h-4 mr-2" strokeWidth={1.75} />
            Sair
          </Button>
        </form>
      </div>
    </SidebarShell>
  )
}
