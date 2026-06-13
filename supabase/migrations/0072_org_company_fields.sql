-- =====================================================================
-- Organizations: campos da empresa para cotações/propostas
--
-- A tela Configurações › Geral › "Sua Empresa" lê/grava estes campos
-- (mesmos dados que aparecem no cabeçalho/rodapé das cotações). Algumas
-- colunas já existiam (contact_phone, contact_email, address_city/state/zip),
-- mas cnpj, cadastur, instagram, website e address_street faltavam neste
-- projeto — o SELECT falhava e a lista vinha vazia
-- ("Nenhuma organização encontrada.").
-- =====================================================================

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS cnpj           TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS cadastur       TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS instagram      TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS website        TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address_street TEXT;
