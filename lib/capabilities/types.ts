import type { PermissionKey } from '@/lib/permissions'
import type { FeatureKey } from '@/lib/plans/config'
import type { ModuleKey } from '@/lib/niche-modules'
import type { NicheKey } from '@/lib/niche'

/**
 * Uma capability é a unidade única de autorização que Navigation, Routes,
 * APIs, IA/Tools e Automações consultam (issue #31). Ela NÃO é um novo
 * sistema de permissão — é a composição, num único lugar, dos sistemas que
 * já existem e que hoje são checados de forma dispersa e inconsistente
 * (auditoria #31): permissão por membership (`lib/permissions.ts`), plano
 * por conta (`lib/plans/server.ts::checkFeatureAccess`), módulo por nicho
 * (`lib/niche-modules.ts::isModuleEnabled`, que já embute o kill-switch de
 * `lib/module-flags.ts`).
 *
 * `permission`/`feature`/`module`/`requiresNiche` são independentes: uma
 * capability só passa se TODAS as regras presentes passarem (AND). Nenhuma
 * regra presente = sempre permitido a qualquer membro autenticado da org
 * (uso hoje: Dashboards, Contracts — Core sem gate dedicado ainda,
 * documentado inline no registry).
 *
 * `anyOf` cobre os casos em que o produto real aceita caminhos alternativos
 * (ex.: Conversas libera com permissão de WhatsApp OU de Social/Instagram)
 * — quando presente, as outras chaves deste objeto são ignoradas e a
 * capability passa se qualquer regra da lista passar (OR entre sub-regras,
 * cada uma com seu próprio AND interno).
 */
export interface CapabilityRule {
  /** Exige essa permissão no membership (owner sempre passa, admin passa por padrão, member exige grant explícito — ver canAccess). */
  permission?: PermissionKey
  /** Exige esse feature flag no plano da CONTA (não da org) — checkFeatureAccess já é fail-closed e é a fonte de verdade real (SQL). */
  feature?: FeatureKey
  /** Exige que o módulo esteja habilitado pro nicho da org E não esteja desligado via kill-switch de super-admin. */
  module?: ModuleKey
  /** Exige que a org seja dessa vertical — usado pelas capabilities "guarda-chuva" (vertical.travel, vertical.clinic) que não mapeiam pra um único ModuleKey. */
  requiresNiche?: NicheKey
  /** Caminhos alternativos — a capability passa se QUALQUER item passar. Substitui as demais chaves quando presente. */
  anyOf?: CapabilityRule[]
}

export type CapabilityKey =
  // ── Core ──────────────────────────────────────────────────────────────
  | 'core.contacts'
  | 'core.pipeline'
  | 'core.sales'
  | 'core.agenda'
  | 'core.forms'
  | 'core.automations'
  | 'core.conversations'
  | 'core.ads'
  | 'core.sales_coach'
  | 'core.voice'
  | 'core.campaigns'
  | 'core.dashboards'
  | 'core.reports'
  | 'core.reviews'
  | 'core.contracts'
  // ── Vertical: Viagens ─────────────────────────────────────────────────
  | 'vertical.travel'
  | 'vertical.travel.cotacoes'
  | 'vertical.travel.roteirista'
  | 'vertical.travel.ofertas'
  | 'vertical.travel.embarques'
  | 'vertical.travel.bloqueios'
  | 'vertical.travel.reservas'
  | 'vertical.travel.documentos'
  // ── Vertical: Clínicas ────────────────────────────────────────────────
  | 'vertical.clinic'
  | 'vertical.clinic.profissionais'
  | 'vertical.clinic.orcamentos'
  | 'vertical.clinic.atendimentos'
  | 'vertical.clinic.tratamentos'
  | 'vertical.clinic.lista_espera'
  | 'vertical.clinic.comissoes'
  | 'vertical.clinic.retornos'
  | 'vertical.clinic.prontuario'
  | 'vertical.clinic.estoque'
  // ── Verticais com granularidade única (módulo == vertical inteira) ────
  | 'vertical.real_estate'
  | 'vertical.insurance'
  | 'vertical.traffic'
