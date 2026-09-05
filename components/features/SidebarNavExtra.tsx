import SidebarUnreadBadge from './SidebarUnreadBadge'
import SidebarNavLink from './SidebarNavLink'
import SidebarSupportLink from './SidebarSupportLink'
import type { Permissions, MemberRole } from '@/lib/permissions'
import { canAccess } from '@/lib/permissions'
import { isModuleEnabled } from '@/lib/niche-modules'
import {
  FileText, Package, Zap, Settings, Megaphone, Send, FileSignature,
  Star, Building2, ShieldAlert, Target, FileStack,
} from 'lucide-react'

/** Non-interactive section divider label. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pt-4 pb-1 text-[10px] uppercase tracking-[0.06em] font-bold text-muted-foreground select-none">
      {children}
    </p>
  )
}

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

/** Seguros / Agências de Tráfego niche sections, plus Comunicação,
 * Marketing, Operações, Configurações and Suporte. Split out of
 * Sidebar.tsx. */
export function SidebarNavExtra({
  base, orgSlug, orgId, niche, userRole, userPermissions,
  planWhatsapp, planInstagram, planBulkCampaigns,
  unreadWhatsapp, unreadInstagram,
}: {
  base: string
  orgSlug: string
  orgId: string
  niche: string | null
  userRole: MemberRole
  userPermissions: Permissions
  planWhatsapp: boolean
  planInstagram: boolean
  planBulkCampaigns: boolean
  unreadWhatsapp: number
  unreadInstagram: number
}) {
  function can(key: Parameters<typeof canAccess>[2]) {
    return canAccess(userRole, userPermissions, key)
  }

  return (
    <>
      {isModuleEnabled(niche, 'seguros') && can('seguros') && (
        <>
          {/* ── Seguros ───────────────────────────── */}
          <SectionLabel>Seguros</SectionLabel>

          <SidebarNavLink href={`${base}/cotacoes-seguro`}>
            <span className="flex items-center gap-2.5">
              <FileSignature className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Cotações</span>
            </span>
          </SidebarNavLink>

          <SidebarNavLink href={`${base}/produtos-seguro`}>
            <span className="flex items-center gap-2.5">
              <Package className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Produtos</span>
            </span>
          </SidebarNavLink>

          <SidebarNavLink href={`${base}/seguradoras`}>
            <span className="flex items-center gap-2.5">
              <Building2 className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Seguradoras</span>
            </span>
          </SidebarNavLink>

          <SidebarNavLink href={`${base}/apolices`}>
            <span className="flex items-center gap-2.5">
              <FileStack className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Apólices</span>
            </span>
          </SidebarNavLink>

          <SidebarNavLink href={`${base}/sinistros`}>
            <span className="flex items-center gap-2.5">
              <ShieldAlert className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Sinistros</span>
            </span>
          </SidebarNavLink>
        </>
      )}

      {isModuleEnabled(niche, 'trafego') && can('trafego') && (
        <>
          {/* ── Agências de Tráfego ───────────────────── */}
          <SectionLabel>Agências de Tráfego</SectionLabel>

          <SidebarNavLink href={`${base}/agencias-trafego/trafego`}>
            <span className="flex items-center gap-2.5">
              <Target className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span>Clientes</span>
            </span>
          </SidebarNavLink>
        </>
      )}

      {/* ── Comunicação ───────────────────────────── */}
      <SectionLabel>Comunicação</SectionLabel>

      {can('conversations') && planWhatsapp && (
        <SidebarNavLink href={`${base}/conversas`}>
          <span className="flex items-center gap-2.5">
            <WhatsAppIcon />
            <span>WhatsApp</span>
            <SidebarUnreadBadge orgId={orgId} initialCount={unreadWhatsapp} />
          </span>
        </SidebarNavLink>
      )}

      {can('social') && planInstagram && (
        <SidebarNavLink href={`${base}/social`}>
          <span className="flex items-center gap-2.5">
            <IgIcon />
            <span>Instagram</span>
            <SidebarUnreadBadge orgId={orgId} initialCount={unreadInstagram} table="social_conversations" />
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
    </>
  )
}
