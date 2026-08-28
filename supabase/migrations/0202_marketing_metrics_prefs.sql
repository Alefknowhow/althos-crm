-- Preferências de exibição do painel de Anúncios (quais KPI cards e quais
-- métricas do gráfico "Evolução das métricas" ficam visíveis) — salvas por
-- org, pra persistir entre sessões (MetricPicker em Marketing).
alter table org_settings add column if not exists marketing_metrics_prefs jsonb;
