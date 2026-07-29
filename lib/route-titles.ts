/** Rótulo da primeira linha da página, derivado do 1º segmento após /app/{orgSlug}/ — mesmos nomes usados no Sidebar. */
const ROUTE_TITLES: Record<string, string> = {
  '': 'Inicial',
  relatorios: 'Relatórios',
  pipeline: 'Pipeline',
  contatos: 'Contatos',
  tarefas: 'Tarefas',
  cotacoes: 'Cotações',
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
  marketing: 'Campanhas',
  forms: 'Formulários',
  financeiro: 'Financeiro',
  automacoes: 'Automações',
  configuracoes: 'Configurações',
  ajuda: 'Central de Ajuda',
}

export function getPageTitle(pathname: string, orgSlug: string): string {
  const prefix = `/app/${orgSlug}`
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname
  const segment = rest.split('/').filter(Boolean)[0] ?? ''
  return ROUTE_TITLES[segment] ?? ''
}
