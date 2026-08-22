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
  // Nicho de viagens — substituem 'sales' com granularidade por módulo
  // (uma agência pode dar acesso só a Reservas, sem liberar Cotações, etc).
  | 'reservas'
  | 'cotacoes'
  | 'ofertas'
  | 'embarques'
  | 'bloqueios'
  | 'explorar_voos'
  | 'documentos'
  | 'roteirista'
  // Nicho de clínicas
  | 'profissionais'
  | 'orcamentos_clinica'
  | 'atendimentos_clinica'
  | 'tratamentos_clinica'
  | 'lista_espera_clinica'
  | 'comissoes_clinica'
  // Nicho de imobiliárias
  | 'imoveis'
  // Nicho de seguros
  | 'seguros'
  // Nicho de agências de tráfego
  | 'trafego'
  | 'conversations'
  | 'social'
  | 'insights'
  | 'campaigns'
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
  // Vendas (nichos não-viagens)
  { key: 'pipeline',      label: 'Pipeline',         section: 'Vendas' },
  { key: 'leads',         label: 'Leads',             section: 'Vendas' },
  { key: 'clients',       label: 'Clientes',          section: 'Vendas' },
  { key: 'tasks',         label: 'Tarefas',           section: 'Vendas' },
  { key: 'catalog',       label: 'Catálogo',          section: 'Vendas' },
  { key: 'sales',         label: 'Vendas',            section: 'Vendas' },
  { key: 'calendar',      label: 'Agendamentos',      section: 'Vendas' },
  // Viagens (só orgs do nicho de viagens)
  { key: 'reservas',      label: 'Reservas',          section: 'Viagens' },
  { key: 'cotacoes',      label: 'Cotações',          section: 'Viagens' },
  { key: 'ofertas',       label: 'Ofertas',           section: 'Viagens' },
  { key: 'embarques',     label: 'Embarques',         section: 'Viagens' },
  { key: 'bloqueios',     label: 'Bloqueios',         section: 'Viagens' },
  { key: 'explorar_voos', label: 'Explorar Voos',     section: 'Viagens' },
  { key: 'documentos',    label: 'Documentos',        section: 'Viagens' },
  { key: 'roteirista',    label: 'Travel Planner',    section: 'Viagens' },
  // Clínicas (só orgs do nicho de clínicas)
  { key: 'profissionais', label: 'Profissionais',     section: 'Clínicas' },
  { key: 'orcamentos_clinica', label: 'Orçamentos',   section: 'Clínicas' },
  { key: 'atendimentos_clinica', label: 'Atendimentos', section: 'Clínicas' },
  { key: 'tratamentos_clinica', label: 'Tratamentos e Pacotes', section: 'Clínicas' },
  { key: 'lista_espera_clinica', label: 'Lista de Espera', section: 'Clínicas' },
  { key: 'comissoes_clinica', label: 'Comissões', section: 'Clínicas' },
  // Imobiliárias (só orgs do nicho imobiliário)
  { key: 'imoveis',        label: 'Imóveis',           section: 'Imobiliárias' },
  // Seguros (só orgs do nicho de seguros)
  { key: 'seguros',        label: 'Seguros',           section: 'Seguros' },
  // Agências de Tráfego (só orgs do nicho de tráfego)
  { key: 'trafego',        label: 'Agências de Tráfego', section: 'Agências de Tráfego' },
  // Comunicação
  { key: 'conversations', label: 'Conversas (WA)',    section: 'Comunicação' },
  { key: 'social',        label: 'Social · DMs',      section: 'Comunicação' },
  { key: 'insights',      label: 'Copiloto IA',       section: 'Comunicação' },
  { key: 'campaigns',     label: 'Campanhas de Envio', section: 'Comunicação' },
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
    campaigns:     false,
    clients:       false,
    catalog:       false,
    sales:         false,
    reservas:      false,
    cotacoes:      false,
    ofertas:       false,
    embarques:     false,
    bloqueios:     false,
    explorar_voos: false,
    documentos:    false,
    roteirista:    false,
    profissionais: false,
    orcamentos_clinica: false,
    atendimentos_clinica: false,
    tratamentos_clinica: false,
    lista_espera_clinica: false,
    comissoes_clinica: false,
    imoveis:       false,
    seguros:       false,
    trafego:       false,
    marketing:     false,
    automations:   false,
    templates:     false,
    forms:         false,
    financial:     false,
    settings:      false,
  }
}

const TRAVEL_ONLY_KEYS = new Set<PermissionKey>([
  'reservas', 'cotacoes', 'ofertas', 'embarques', 'bloqueios', 'explorar_voos', 'documentos', 'roteirista',
])
const NON_TRAVEL_ONLY_KEYS = new Set<PermissionKey>(['sales', 'calendar', 'profissionais', 'orcamentos_clinica', 'atendimentos_clinica', 'tratamentos_clinica', 'lista_espera_clinica', 'comissoes_clinica', 'imoveis', 'seguros', 'trafego'])

/**
 * Group modules by section for rendering. Pass `isTravel` to hide the
 * modules that don't apply to the org's nicho: orgs de viagens não veem
 * Vendas/Agendamentos (usam Reservas/Cotações/etc no lugar), e o inverso
 * pros demais nichos. Sem o argumento, devolve tudo (uso legado).
 */
export function groupedModules(isTravel?: boolean): Record<string, PermissionModule[]> {
  const out: Record<string, PermissionModule[]> = {}
  for (const m of PERMISSION_MODULES) {
    if (isTravel === true && NON_TRAVEL_ONLY_KEYS.has(m.key)) continue
    if (isTravel === false && TRAVEL_ONLY_KEYS.has(m.key)) continue
    if (!out[m.section]) out[m.section] = []
    out[m.section].push(m)
  }
  return out
}

// NOTE: checkMemberPermission (server-only, uses next/headers) lives in
// lib/permissions.server.ts — import from there inside Server Actions only.
