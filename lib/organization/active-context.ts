// Contrato reutilizável de "organização ativa" (issue #30), consumido pelo
// seletor de organização da #10 e por qualquer superfície que precise de
// identidade/permissões da org sem reimplementar a resolução.
//
// A organização ativa continua sendo derivada do orgSlug na URL a cada
// request (não há cookie/preferência de "última org" — ver auditoria da
// #30). Este módulo não muda esse mecanismo, só padroniza o formato do
// contexto para quem consome.

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization, getUser } from '@/lib/supabase/types'
import type { MemberRole, Permissions } from '@/lib/permissions'
import { deriveInitials } from '@/lib/organization/initials'

export { deriveInitials }

export interface ActiveOrganizationContext {
  organizationId: string
  accountId: string | null
  slug: string
  name: string
  initials: string
  logoUrl: string | null
  /** Unidade/filial da organização dentro da conta, quando existir. Multi-org por conta já existe (accounts -> N organizations); não há campo de "unidade" hoje — placeholder para a #10 renderizar condicionalmente. */
  unit: string | null
  role: MemberRole
  permissions: Permissions
}

/**
 * Resolve o contexto padronizado da organização ativa (por orgSlug) para o
 * usuário autenticado. Lança notFound() via getCurrentOrganization se a org
 * não existir ou o usuário não for membro (RLS).
 */
export async function getActiveOrganizationContext(orgSlug: string): Promise<ActiveOrganizationContext> {
  const org = await getCurrentOrganization(orgSlug)
  const user = await getUser()

  const supabase = createClient()
  const { data: membership } = await supabase
    .from('memberships')
    .select('role, permissions')
    .eq('organization_id', org.id)
    .eq('user_id', user?.id ?? '')
    .maybeSingle()

  return {
    organizationId: org.id,
    accountId: org.account_id ?? null,
    slug: org.slug,
    name: org.name,
    initials: deriveInitials(org.name),
    logoUrl: org.logo_url ?? null,
    unit: null,
    role: (membership?.role as MemberRole) ?? 'member',
    permissions: (membership?.permissions ?? {}) as Permissions,
  }
}
