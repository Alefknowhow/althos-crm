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
