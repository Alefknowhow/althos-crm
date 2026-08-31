-- Cadastro completo de profissional (Clínicas): foto + telefone/e-mail —
-- mesmo padrão de avatar já usado em contatos (avatar_storage_object_id,
-- resolvido pra signed URL do R2 na leitura, ver actions/contatos.ts).
ALTER TABLE clinic_professionals
  ADD COLUMN IF NOT EXISTS avatar_storage_object_id TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN clinic_professionals.avatar_storage_object_id IS 'Referência da foto de perfil no storage (R2) — resolvida pra signed URL na leitura, mesmo padrão de contatos.avatar_storage_object_id.';
