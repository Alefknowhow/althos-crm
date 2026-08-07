-- Acelera a query de CAC/ROAS por campanha (getMarketingOverview), que
-- soma negócios ganhos por organização no período.
CREATE INDEX IF NOT EXISTS idx_contatos_deal_status_ganho
  ON contatos (organization_id, deal_status)
  WHERE deal_status = 'ganho';
