-- ---------------------------------------------------------------------
-- Google Meu Negócio (Google Business Profile) — Fase 1: conexão OAuth.
-- Tabela própria (em vez de generalizar social_connections) porque o
-- fluxo do Google usa refresh_token (renovação server-side) e uma conta
-- pode ter várias localizações (locations), cada uma vinculável
-- individualmente pela organização.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.google_business_connections (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  google_account_id  TEXT NOT NULL,          -- resource name, ex.: "accounts/1234567890"
  account_name       TEXT,                   -- nome de exibição da conta Google
  refresh_token      TEXT NOT NULL,
  access_token       TEXT,
  token_expires_at   TIMESTAMPTZ,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, google_account_id)
);

CREATE TABLE IF NOT EXISTS public.google_business_locations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id      UUID NOT NULL REFERENCES public.google_business_connections(id) ON DELETE CASCADE,
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  google_location_id TEXT NOT NULL,          -- resource name, ex.: "locations/9876543210"
  title              TEXT,                   -- nome da unidade/ficha
  address            TEXT,
  is_linked          BOOLEAN NOT NULL DEFAULT false, -- selecionada pela org pra sincronizar
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, google_location_id)
);

CREATE INDEX IF NOT EXISTS idx_gbp_connections_org ON public.google_business_connections (organization_id);
CREATE INDEX IF NOT EXISTS idx_gbp_locations_org    ON public.google_business_locations (organization_id);
CREATE INDEX IF NOT EXISTS idx_gbp_locations_conn   ON public.google_business_locations (connection_id);

ALTER TABLE public.google_business_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_business_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Google Business connections access" ON public.google_business_connections
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Super admin access connections" ON public.google_business_connections
  FOR SELECT USING ((SELECT is_super_admin()));

CREATE POLICY "Google Business locations access" ON public.google_business_locations
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Super admin access locations" ON public.google_business_locations
  FOR SELECT USING ((SELECT is_super_admin()));

CREATE TRIGGER trg_gbp_connections_updated_at
  BEFORE UPDATE ON public.google_business_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_gbp_locations_updated_at
  BEFORE UPDATE ON public.google_business_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
