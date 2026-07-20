-- ---------------------------------------------------------------------
-- Créditos de Viagem — crédito que a operadora concede ao cliente quando
-- uma reserva é cancelada, para uso em uma venda futura. Vinculado ao
-- contato (não à venda em si, que pode não existir mais).
-- ---------------------------------------------------------------------

CREATE TABLE public.travel_credits (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contato_id         UUID NOT NULL REFERENCES public.contatos(id) ON DELETE CASCADE,
  valor_cents        INTEGER NOT NULL CHECK (valor_cents > 0),
  valor_usado_cents  INTEGER NOT NULL DEFAULT 0 CHECK (valor_usado_cents >= 0),
  operadora          TEXT NOT NULL,
  data_emissao       DATE NOT NULL DEFAULT CURRENT_DATE,
  validade           DATE,
  -- Venda que originou o crédito (cancelamento). ON DELETE SET NULL: o
  -- crédito continua valendo mesmo se a venda de origem for apagada.
  origem_sale_id     UUID REFERENCES public.travel_sales(id) ON DELETE SET NULL,
  status             TEXT NOT NULL DEFAULT 'available'
                       CHECK (status IN ('available', 'used', 'cancelled')),
  observacoes        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT travel_credits_saldo_valido CHECK (valor_usado_cents <= valor_cents)
);

CREATE INDEX idx_travel_credits_org      ON public.travel_credits (organization_id);
CREATE INDEX idx_travel_credits_contato  ON public.travel_credits (contato_id);
CREATE INDEX idx_travel_credits_origem   ON public.travel_credits (origem_sale_id);

ALTER TABLE public.travel_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Travel credits access" ON public.travel_credits
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Super admin access" ON public.travel_credits
  FOR SELECT USING ((SELECT is_super_admin()));

CREATE POLICY "Super admin update" ON public.travel_credits
  FOR UPDATE USING ((SELECT is_super_admin()));

-- ---------------------------------------------------------------------
-- Histórico de utilização — cada vez que parte (ou todo) um crédito é
-- aplicado numa venda. Permite saldo parcial e histórico completo.
-- ---------------------------------------------------------------------

CREATE TABLE public.travel_credit_usages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  credit_id          UUID NOT NULL REFERENCES public.travel_credits(id) ON DELETE CASCADE,
  sale_id            UUID REFERENCES public.travel_sales(id) ON DELETE SET NULL,
  valor_cents        INTEGER NOT NULL CHECK (valor_cents > 0),
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_travel_credit_usages_org    ON public.travel_credit_usages (organization_id);
CREATE INDEX idx_travel_credit_usages_credit ON public.travel_credit_usages (credit_id);
CREATE INDEX idx_travel_credit_usages_sale   ON public.travel_credit_usages (sale_id);

ALTER TABLE public.travel_credit_usages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Travel credit usages access" ON public.travel_credit_usages
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Super admin access" ON public.travel_credit_usages
  FOR SELECT USING ((SELECT is_super_admin()));

CREATE POLICY "Super admin update" ON public.travel_credit_usages
  FOR UPDATE USING ((SELECT is_super_admin()));
