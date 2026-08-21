ALTER TABLE contatos
  ADD COLUMN IF NOT EXISTS property_preferences JSONB;

COMMENT ON COLUMN contatos.property_preferences IS
  'Vertical Imobiliárias (Fase 4) — preferências de imóvel do lead, preenchidas manualmente pelo corretor. Shape: { purpose?, priceMin?, priceMax?, bedroomsMin?, city?, neighborhood?, propertyType?, notes? }. Usado como filtro/contexto para o matching por IA.';
