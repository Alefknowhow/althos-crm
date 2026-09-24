/** Rótulo da primeira linha da página, derivado do 1º segmento após /app/{orgSlug}/ — mesmos nomes usados no Sidebar. */
const ROUTE_TITLES: Record<string, string> = {
  '': 'Dashboards',
  relatorios: 'Relatórios',
  pipeline: 'Pipeline',
  contatos: 'Contatos',
  tarefas: 'Tarefas',
  cotacoes: 'Cotações',
  roteirista: 'Travel Planner',
  ofertas: 'Ofertas',
  embarques: 'Embarques',
  bloqueios: 'Bloqueios',
  catalogo: 'Catálogo',
  vendas: 'Vendas',
  reservas: 'Reservas',
  documentos: 'Documentos',
  agendamentos: 'Agendamentos',
  conversas: 'Conversas',
  social: 'Instagram',
  marketing: 'Anúncios',
  forms: 'Formulários',
  financeiro: 'Financeiro',
  automacoes: 'Automações',
  campanhas: 'Campanhas de Envio',
  'whatsapp-templates': 'Templates WhatsApp',
  'email-templates': 'Templates de Email',
  configuracoes: 'Configurações',
  ajuda: 'Central de Ajuda',
  avaliacoes: 'Avaliações do Google',
  profissionais: 'Profissionais',
  orcamentos: 'Orçamentos',
  atendimentos: 'Atendimentos',
  tratamentos: 'Tratamentos e Pacotes',
  'lista-espera': 'Lista de Espera',
  comissoes: 'Comissões',
  retornos: 'Retornos',
  imoveis: 'Imóveis',
  'pipeline-imoveis': 'Pipeline',
  visitas: 'Visitas',
  propostas: 'Propostas',
  negociacoes: 'Negociações',
  'produtos-seguro': 'Produtos de Seguro',
  seguradoras: 'Seguradoras',
  'cotacoes-seguro': 'Cotações',
  apolices: 'Apólices',
  sinistros: 'Sinistros',
}

/**
 * Vertical Agências de Tráfego — única vertical com rotas aninhadas sob um
 * segmento pai. Só as páginas sem equivalente genérico (Visão Geral,
 * Tráfego, Leads, Performance) vivem aqui — Clientes/Vendas/Equipe/
 * Financeiro/Relatórios foram removidas na Etapa 2 (Fase B): a vertical
 * adapta as telas genéricas existentes em vez de duplicá-las. Chave de 2
 * segmentos, tentada ANTES do fallback de 1 segmento em
 * getPageTitle/PageIcon — retrocompatível, nenhuma rota de 1 segmento já
 * existente muda de comportamento.
 */
const ROUTE_TITLES_2SEG: Record<string, string> = {
  'agencias-trafego/trafego': 'Clientes',
}

/** 1º segmento após /app/{orgSlug}/ — usado tanto pro título quanto pro ícone da página. */
export function getRouteSegment(pathname: string, orgSlug: string): string {
  const prefix = `/app/${orgSlug}`
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname
  return rest.split('/').filter(Boolean)[0] ?? ''
}

/** 1º + 2º segmentos após /app/{orgSlug}/, unidos por "/" — só usado pra
 *  verticais com rotas aninhadas (ver ROUTE_TITLES_2SEG acima). */
export function getRouteSegment2(pathname: string, orgSlug: string): string {
  const prefix = `/app/${orgSlug}`
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname
  return rest.split('/').filter(Boolean).slice(0, 2).join('/')
}

export function getPageTitle(pathname: string, orgSlug: string): string {
  return ROUTE_TITLES_2SEG[getRouteSegment2(pathname, orgSlug)] ?? ROUTE_TITLES[getRouteSegment(pathname, orgSlug)] ?? ''
}

/** Sub-seções de /configuracoes — fonte única usada pelo acordeão da sidebar
 *  (SidebarConfigAccordion), pelo dropdown mobile (SettingsTabsNav) e pelo
 *  título do módulo no header (HeaderModuleTitle, via getSubLabel). */
export const CONFIG_SUB_ITEMS = [
  { seg: '',             label: 'Geral' },
  { seg: 'agente-ia',    label: 'Agente IA' },
  { seg: 'dados',        label: 'Importação/Exportação' },
  { seg: 'integracoes',  label: 'Integrações' },
  { seg: 'agentes',      label: 'Conector MCP' },
] as const

/** Sub-seções de /marketing (issue #24) — mesmo papel do CONFIG_SUB_ITEMS
 *  acima, usado pelo SidebarMarketingAccordion e pelo HeaderModuleTitle. */
export const MARKETING_SUB_ITEMS = [
  { seg: '',           label: 'Visão Geral' },
  { seg: 'meta-ads',   label: 'Meta Ads' },
  { seg: 'google-ads', label: 'Google Ads' },
] as const

const SUB_ITEMS_BY_SEGMENT: Record<string, readonly { seg: string; label: string }[]> = {
  configuracoes: CONFIG_SUB_ITEMS,
  marketing: MARKETING_SUB_ITEMS,
}

/** Rótulo do 2º segmento dentro de uma rota com sub-navegação conhecida
 *  (Configurações, Anúncios) — usado no título do módulo no header pra
 *  formar "Configurações / Agente IA", "Anúncios / Meta Ads" etc. */
export function getSubLabel(seg1: string, seg2: string): string | null {
  const items = SUB_ITEMS_BY_SEGMENT[seg1]
  return items?.find(i => i.seg === seg2)?.label ?? null
}
