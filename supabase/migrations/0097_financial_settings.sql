-- ---------------------------------------------------------------------
-- Configurações financeiras: listas cadastráveis (categoria, subcategoria,
-- centro de custo, conta bancária, operadora, forma de pagamento) usadas
-- como opções de seleção nos lançamentos, em vez de texto livre.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.financial_settings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type               TEXT NOT NULL CHECK (type IN ('categoria', 'subcategoria', 'centro_custo', 'conta_bancaria', 'operadora', 'forma_pagamento')),
  name               TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, type, name)
);

CREATE INDEX IF NOT EXISTS idx_financial_settings_org_type ON public.financial_settings (organization_id, type);

ALTER TABLE public.financial_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financial settings access" ON public.financial_settings
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Super admin access" ON public.financial_settings
  FOR SELECT USING ((SELECT is_super_admin()));

-- Backfill: cadastra automaticamente os valores de texto livre já usados
-- nos lançamentos existentes, pra ninguém perder o histórico ao trocar
-- pra seleção fixa.
INSERT INTO public.financial_settings (organization_id, type, name)
SELECT DISTINCT organization_id, 'categoria', categoria FROM public.financial_entries WHERE categoria IS NOT NULL AND categoria <> ''
ON CONFLICT DO NOTHING;

INSERT INTO public.financial_settings (organization_id, type, name)
SELECT DISTINCT organization_id, 'subcategoria', subcategoria FROM public.financial_entries WHERE subcategoria IS NOT NULL AND subcategoria <> ''
ON CONFLICT DO NOTHING;

INSERT INTO public.financial_settings (organization_id, type, name)
SELECT DISTINCT organization_id, 'centro_custo', centro_custo FROM public.financial_entries WHERE centro_custo IS NOT NULL AND centro_custo <> ''
ON CONFLICT DO NOTHING;

INSERT INTO public.financial_settings (organization_id, type, name)
SELECT DISTINCT organization_id, 'conta_bancaria', conta_bancaria FROM public.financial_entries WHERE conta_bancaria IS NOT NULL AND conta_bancaria <> ''
ON CONFLICT DO NOTHING;

INSERT INTO public.financial_settings (organization_id, type, name)
SELECT DISTINCT organization_id, 'operadora', operadora FROM public.financial_entries WHERE operadora IS NOT NULL AND operadora <> ''
ON CONFLICT DO NOTHING;

INSERT INTO public.financial_settings (organization_id, type, name)
SELECT DISTINCT organization_id, 'forma_pagamento', forma_pagamento FROM public.financial_entries WHERE forma_pagamento IS NOT NULL AND forma_pagamento <> ''
ON CONFLICT DO NOTHING;
