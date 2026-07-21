-- ---------------------------------------------------------------------
-- Mapa de bloqueios: lotes de assentos aéreos garantidos com a
-- operadora/cia pra revenda (espelha a planilha usada pela agência:
-- OD, datas, voos ida/volta com horários, assentos disponíveis e prazo
-- de release).
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.travel_blocks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  origem             TEXT NOT NULL,          -- ex.: GYN
  destino            TEXT NOT NULL,          -- ex.: FOR
  data_ida           DATE NOT NULL,
  data_volta         DATE,
  voo_ida            TEXT,                   -- ex.: 4185/2932
  horario_ida        TEXT,                   -- ex.: 19:25/01:40
  voo_volta          TEXT,
  horario_volta      TEXT,
  assentos_total     INTEGER,                -- opcional: tamanho original do lote
  assentos_disponiveis INTEGER NOT NULL DEFAULT 0,
  prazo              DATE,                   -- release/prazo de devolução
  observacoes        TEXT,
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_travel_blocks_org ON public.travel_blocks (organization_id, data_ida);

ALTER TABLE public.travel_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Travel blocks access" ON public.travel_blocks
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Super admin access" ON public.travel_blocks
  FOR SELECT USING ((SELECT is_super_admin()));

CREATE TRIGGER trg_travel_blocks_updated_at
  BEFORE UPDATE ON public.travel_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
