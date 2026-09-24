import SidebarUnreadBadge from './SidebarUnreadBadge'
import SidebarNavLink from './SidebarNavLink'
import SidebarSupportLink from './SidebarSupportLink'
import SidebarConfigAccordion from './SidebarConfigAccordion'
import SidebarMarketingAccordion from './SidebarMarketingAccordion'
import SidebarVoiceAccordion from './SidebarVoiceAccordion'
import SidebarClientAccordion from './SidebarClientAccordion'
import type { Permissions, MemberRole } from '@/lib/permissions'
import { canAccess } from '@/lib/permissions'
import { isModuleEnabled } from '@/lib/niche-modules'
import { getDisabledModulesForNiche } from '@/lib/module-flags'
import {
  FileText, Package, Zap, Send, FileSignature,
  Star, Building2, ShieldAlert, FileStack, MessageCircle, Headset,
} from 'lucide-react'

/** Non-interactive section divider label. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pt-4 pb-1 text-[10px] uppercase tracking-[0.06em] font-bold text-sidebar-foreground/45 select-none">
      {children}
    </p>
  )
}


/** Seguros / Agências de Tráfego niche sections, plus Comunicação,
 * Marketing, Operações, Configurações and Suporte. Split out of
 * Sidebar.tsx. */
export async function SidebarNavExtra({
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
  const disabledModules = await getDisabledModulesForNiche(niche)

  return (
    <>
      {isModuleEnabled(niche, 'seguros', disabledModules) && can('seguros') && (
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

      {isModuleEnabled(niche, 'trafego', disabledModules) && can('trafego') && (
        <>
          {/* ── Agências de Tráfego ───────────────────── */}
          <SectionLabel>Agências de Tráfego</SectionLabel>

          <SidebarClientAccordion base={base} />
        </>
      )}

      {/* ── Comunicação ───────────────────────────── */}
      <SectionLabel>Comunicação</SectionLabel>

      {/* WhatsApp + Instagram viraram um módulo só ("Conversas", com troca
          de canal por aba) — um item de menu cobre os dois, com os dois
          badges de não-lidos lado a lado. Cada plano ainda gate por conta
          (uma org pode ter só WhatsApp, só Instagram, ou os dois). */}
      {((can('conversations') && planWhatsapp) || (can('social') && planInstagram)) && (
        <SidebarNavLink href={`${base}/conversas`}>
          <span className="flex items-center gap-2.5">
            <MessageCircle className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>Conversas</span>
            {can('conversations') && planWhatsapp && (
              <SidebarUnreadBadge orgId={orgId} initialCount={unreadWhatsapp} />
            )}
            {can('social') && planInstagram && (
              <SidebarUnreadBadge orgId={orgId} initialCount={unreadInstagram} table="social_conversations" />
            )}
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

      {can('voice') && <SidebarVoiceAccordion base={base} />}

      {can('sales_coach') && (
        <SidebarNavLink href={`${base}/sales-coach`}>
          <span className="flex items-center gap-2.5">
            <Headset className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>IA Sales Coach</span>
          </span>
        </SidebarNavLink>
      )}

      {/* ── Marketing ─────────────────────────────── */}
      {/* Rótulo também some no mobile — os dois itens da seção (Anúncios,
          Formulários) ficam ocultos ali, não faz sentido um cabeçalho vazio. */}
      <div className="hidden md:block">
        <SectionLabel>Marketing</SectionLabel>
      </div>

      {can('marketing') && (
        <div className="hidden md:block">
          <SidebarMarketingAccordion base={base} />
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
          <SidebarConfigAccordion base={base} />
        </>
      )}

      {/* ── Suporte ────────────────────────────────── */}
      <SectionLabel>Suporte</SectionLabel>
      <SidebarSupportLink orgSlug={orgSlug} />
    </>
  )
}
