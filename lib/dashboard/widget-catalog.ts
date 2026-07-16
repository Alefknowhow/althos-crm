// Metadados dos widgets da Inicial, sem importar nenhum componente — este
// arquivo é seguro para uso em Client Components (DashboardCustomizer).
// A renderização de fato (que importa os componentes server-only) mora em
// widget-registry.tsx, usado só a partir de Server Components.

export type WidgetSize = 'half' | 'full'

export type WidgetMeta = {
  key: string
  label: string
  size: WidgetSize
}

export const WIDGET_CATALOG: WidgetMeta[] = [
  { key: 'metrics', label: 'Indicadores principais', size: 'full' },
  { key: 'metric_chart', label: 'Gráfico de métrica', size: 'half' },
  { key: 'lead_sources', label: 'Origem dos leads', size: 'half' },
  { key: 'funnel', label: 'Funil de conversão', size: 'half' },
  { key: 'tasks_today', label: 'Tarefas de hoje', size: 'half' },
  { key: 'pipeline_at_risk', label: 'Leads em risco', size: 'half' },
  { key: 'time_in_stage', label: 'Tempo por estágio', size: 'half' },
  { key: 'revenue_forecast', label: 'Forecast de receita', size: 'half' },
  { key: 'source_performance', label: 'Desempenho por origem', size: 'half' },
  { key: 'sellers_ranking', label: 'Ranking de vendedores', size: 'half' },
  { key: 'recent_activity', label: 'Atividade recente', size: 'full' },
]

export const WIDGET_KEYS = WIDGET_CATALOG.map(w => w.key)
export const DEFAULT_WIDGET_KEYS = [...WIDGET_KEYS]

export function getWidgetMeta(key: string): WidgetMeta | undefined {
  return WIDGET_CATALOG.find(w => w.key === key)
}
