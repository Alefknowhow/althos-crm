-- Novo recurso gateável "bulk_campaigns" (Campanhas de Envio) — mesmo
-- corte de ai_insights/export_reports: só Pro/Business.
update plans set features = features || jsonb_build_object('bulk_campaigns', false) where id in ('free', 'starter');
update plans set features = features || jsonb_build_object('bulk_campaigns', true) where id in ('pro', 'business');
