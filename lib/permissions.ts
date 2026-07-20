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
  | 'financial'
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
  { key: 'insights',      label: 'Copiloto IA',       section: 'Comunicação' },
  // Marketing
  { key: 'marketing',     label: 'Campanhas',         section: 'Marketing' },
  { key: 'forms',         label: 'Formulários',       section: 'Marketing' },
  // Operações
  { key: 'automations',   label: 'Automações',        section: 'Operações' },
  { key: 'templates',     label: 'Templates',         section: 'Operações' },
  { key: 'financial',     label: 'Financeiro',        section: 'Operações' },
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
    financial:     false,
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

// NOTE: checkMemberPermission (server-only, uses next/headers) lives in
// lib/permissions.server.ts — import from there inside Server Actions only.
