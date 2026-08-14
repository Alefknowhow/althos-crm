-- Segundo signatário (agência/quem emite o contrato) além do cliente —
-- contratos de prestação de serviço são bilaterais, então os dois lados
-- assinam digitalmente via Autentique.
ALTER TABLE sale_contracts ADD COLUMN IF NOT EXISTS signer2_name TEXT;
ALTER TABLE sale_contracts ADD COLUMN IF NOT EXISTS signer2_email TEXT;
ALTER TABLE sale_contracts ADD COLUMN IF NOT EXISTS signer2_phone TEXT;
