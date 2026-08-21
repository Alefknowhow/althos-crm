ALTER TABLE property_proposals
  ADD COLUMN IF NOT EXISTS public_token TEXT UNIQUE;

CREATE TABLE IF NOT EXISTS property_proposal_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    proposal_id     UUID NOT NULL REFERENCES property_proposals(id) ON DELETE CASCADE,
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    price_cents     BIGINT NOT NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_proposal_items_proposal ON property_proposal_items (proposal_id);
CREATE INDEX IF NOT EXISTS idx_property_proposal_items_property ON property_proposal_items (property_id);

ALTER TABLE property_proposal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Property proposal items access" ON property_proposal_items
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Property proposal items super admin" ON property_proposal_items
  FOR ALL USING ((SELECT is_super_admin()));

-- RPC pública — security definer, mesmo desenho de get_public_quotation
-- (supabase/migrations/0080_quotation_revamp.sql). Nunca expõe
-- broker_user_id/notes/internal_notes.
CREATE OR REPLACE FUNCTION public.get_public_property_proposal(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  p   public.property_proposals%rowtype;
  org jsonb;
BEGIN
  SELECT * INTO p FROM public.property_proposals
  WHERE public_token = p_token
  LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'legal_name',     coalesce(s.legal_name, o.name),
    'brand_logo_url', coalesce(s.brand_logo_url, o.logo_url),
    'brand_accent',   s.brand_accent,
    'whatsapp_number', coalesce(s.whatsapp_number, nullif(o.contact_phone,'')),
    'city_state',      coalesce(s.city_state, nullif(trim(concat_ws(' / ', nullif(o.address_city,''), nullif(o.address_state,''))), ''))
  ) INTO org
  FROM public.organizations o
  LEFT JOIN public.org_settings s ON s.org_id = o.id
  WHERE o.id = p.organization_id;

  RETURN jsonb_build_object(
    'id', p.id,
    'status', p.status,
    'operation_type', p.operation_type,
    'conditions', p.conditions,
    'valid_until', p.valid_until,
    'created_at', p.created_at,
    'org', org,
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pr.id,
        'title', pr.title,
        'code', pr.code,
        'property_type', pr.property_type,
        'purpose', pr.purpose,
        'address_street', pr.address_street,
        'address_number', pr.address_number,
        'neighborhood', pr.neighborhood,
        'city', pr.city,
        'state', pr.state,
        'bedrooms', pr.bedrooms,
        'suites', pr.suites,
        'bathrooms', pr.bathrooms,
        'parking_spots', pr.parking_spots,
        'area_total', pr.area_total,
        'area_useful', pr.area_useful,
        'description_html', pr.description_html,
        'features', pr.features,
        'price_cents', it.price_cents,
        'photos', coalesce((
          SELECT jsonb_agg(jsonb_build_object('url', m.storage_key, 'is_cover', m.is_cover) ORDER BY m.is_cover DESC, m.sort_order)
          FROM public.property_media m
          WHERE m.property_id = pr.id AND m.media_type = 'photo'
        ), '[]'::jsonb)
      ) ORDER BY it.sort_order)
      FROM public.property_proposal_items it
      JOIN public.properties pr ON pr.id = it.property_id
      WHERE it.proposal_id = p.id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_property_proposal(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_property_proposal(text) TO anon, authenticated;

COMMENT ON TABLE property_proposal_items IS
  'Vertical Imobiliárias (Fase 8) — itens de uma proposta multi-imóvel, cada um com preço próprio. Espelha quotation_products (Viagens): delete+reinsert total a cada save.';
