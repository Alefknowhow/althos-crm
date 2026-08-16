-- ---------------------------------------------------------------------
-- Google Business Profile — avaliações (Fase 2, sobre a conexão OAuth da
-- 0098_google_business.sql). Puxadas via My Business API v4
-- (accounts/*/locations/*/reviews) e respondidas direto do CRM.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.google_business_reviews (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id        UUID NOT NULL REFERENCES public.google_business_locations(id) ON DELETE CASCADE,
  google_review_id   TEXT NOT NULL,          -- nome completo do recurso (accounts/.../reviews/...)
  reviewer_name      TEXT,
  reviewer_photo_url TEXT,
  star_rating        SMALLINT,               -- 1-5 (convertido do enum ONE..FIVE da API)
  comment            TEXT,
  create_time        TIMESTAMPTZ,
  update_time        TIMESTAMPTZ,
  reply_comment      TEXT,
  reply_update_time  TIMESTAMPTZ,
  synced_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, google_review_id)
);

CREATE INDEX IF NOT EXISTS idx_gbp_reviews_org      ON public.google_business_reviews (organization_id);
CREATE INDEX IF NOT EXISTS idx_gbp_reviews_location ON public.google_business_reviews (location_id, create_time DESC);

ALTER TABLE public.google_business_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Google Business reviews access" ON public.google_business_reviews
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Super admin access reviews" ON public.google_business_reviews
  FOR SELECT USING ((SELECT is_super_admin()));

CREATE TRIGGER trg_gbp_reviews_updated_at
  BEFORE UPDATE ON public.google_business_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
