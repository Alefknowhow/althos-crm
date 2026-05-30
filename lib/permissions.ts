// ── Permission module definitions ─────────────────────────────────────────────
//
// Para verificar permissões em Server Actions, use:
//   const check = await checkMemberPermission(orgId, userId, 'leads')
//   if (!check.allowed) return { ok: false as const, error: check.reason }


export type PermissionKey =
  | 'pipeline'
  | 'leads'
  | 'clients'
  | 'tasks'
  | 'catalog'
  | 'sales'
  | 'calendar'
  | 'conversations'
  | 'social'
  | 'insights'
  | 'marketing'
  | 'automations'
  | 'templates'
  | 'forms'
  | 'settings'

export type Permissions = Partial<Record<PermissionKey, boolean>>

export type MemberRole = 'owner' | 'admin' | 'member'

// ── Module metadata (for UI checkboxes) ──────────────────────────────────────

export type PermissionModule = {
  key:     PermissionKey
  label:   string
  section: string
}

export const PERMISSION_MODULES: PermissionModule[] = [
  // Vendas
  { key: 'pipeline',      label: 'Pipeline',         section: 'Vendas' },
  { key: 'leads',         label: 'Leads',             section: 'Vendas' },
  { key: 'clients',       label: 'Clientes',          section: 'Vendas' },
  { key: 'tasks',         label: 'Tarefas',           section: 'Vendas' },
  { key: 'catalog',       label: 'Catálogo',          section: 'Vendas' },
  { key: 'sales',         label: 'Vendas',            section: 'Vendas' },
  { key: 'calendar',      label: 'Agendamentos',      section: 'Vendas' },
  // Comunicação
  { key: 'conversations', label: 'Conversas (WA)',    section: 'Comunicação' },
  { key: 'social',        label: 'Social · DMs',      section: 'Comunicação' },
  { key: 'insights',      label: 'Insights IA',       section: 'Comunicação' },
  // Marketing
  { key: 'marketing',     label: 'Campanhas',         section: 'Marketing' },
  { key: 'forms',         label: 'Formulários',       section: 'Marketing' },
  // Operações
  { key: 'automations',   label: 'Automações',        section: 'Operações' },
  { key: 'templates',     label: 'Templates',         section: 'Operações' },
  // Configurações
  { key: 'settings',      label: 'Configurações',     section: 'Configurações' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true if a user with the given role + permissions can access a module.
 * Owners always pass. Admins pass unless explicitly denied (false).
 * Members must be explicitly granted (true).
 */
export function canAccess(
  role: MemberRole,
  permissions: Permissions,
  key: PermissionKey,
): boolean {
  if (role === 'owner') return true
  if (role === 'admin') return permissions[key] !== false  // default allow, can be revoked
  // member: must be explicitly granted
  return permissions[key] === true
}

/** All permissions set to true — useful as the default for new admins. */
export function allPermissions(): Permissions {
  return Object.fromEntries(
    PERMISSION_MODULES.map(m => [m.key, true])
  ) as Permissions
}

/** Default permissions for a new member (conservative: core sales only). */
export function defaultMemberPermissions(): Permissions {
  return {
    pipeline:      true,
    leads:         true,
    tasks:         true,
    calendar:      true,
    conversations: false,
    social:        false,
    insights:      false,
    clients:       false,
    catalog:       false,
    sales:         false,
    marketing:     false,
    automations:   false,
    templates:     false,
    forms:         false,
    settings:      false,
  }
}

/** Group modules by section for rendering. */
export function groupedModules(): Record<string, PermissionModule[]> {
  const out: Record<string, PermissionModule[]> = {}
  for (const m of PERMISSION_MODULES) {
    if (!out[m.section]) out[m.section] = []
    out[m.section].push(m)
  }
  return out
}

// ── Server-side permission check (use inside Server Actions) ─────────────────

/**
 * Verifica se o usuário autenticado tem permissão para acessar um módulo.
 * Deve ser chamado no início de Server Actions que modificam dados sensíveis.
 *
 * Exemplo de uso numa action:
 *   const check = await checkMemberPermission(org.id, user.id, 'catalog')
 *   if (!check.allowed) return { ok: false as const, error: check.reason }
 */
export async function checkMemberPermission(
  orgId: string,
  userId: string,
  key: PermissionKey,
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  // Dynamic import to avoid circular dependency (lib/supabase imports lib/types)
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = createClient()

  const { data: membership } = await supabase
    .from('memberships')
    .select('role, permissions')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) {
    return { allowed: false, reason: 'Acesso não autorizado.' }
  }

  const role        = membership.role as MemberRole
  const permissions = (membership.permissions ?? {}) as Permissions

  if (!canAccess(role, permissions, key)) {
    return { allowed: false, reason: `Você não tem permissão para acessar o módulo "${key}".` }
  }

  return { allowed: true }
}
