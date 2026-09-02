-- ---------------------------------------------------------------------
-- Perfis de rodapé/identidade salvos — permite reutilizar os dados de uma
-- "segunda marca" (logo, endereço, CNPJ, CADASTUR, Instagram, site,
-- WhatsApp, telefone, e-mail) em várias cotações sem redigitar tudo toda
-- vez. Ver QuotationEditor.tsx (bloco "Rodapé e informações da agência").
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.quotation_footer_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  legal_name            TEXT,
  logo_url              TEXT,
  address               TEXT,
  cnpj                  TEXT,
  cadastur              TEXT,
  instagram_url         TEXT,
  site_url              TEXT,
  whatsapp_number       TEXT,
  phone                 TEXT,
  email                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_quotation_footer_profiles_org ON public.quotation_footer_profiles (organization_id);

ALTER TABLE public.quotation_footer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quotation footer profiles access" ON public.quotation_footer_profiles
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Super admin access" ON public.quotation_footer_profiles
  FOR SELECT USING ((SELECT is_super_admin()));
