-- Item 3 da recomendação da auditoria LGPD (docs/audit/clinicas-lgpd.md):
-- política de retenção específica pra dado clínico. No Brasil, a Resolução
-- CFM nº 1.821/2007 exige guarda mínima de 20 anos do prontuário (contados
-- do último registro), mesmo em suporte digital — diferente do resto do
-- CRM, aqui "excluir" nunca deve ser uma exclusão física imediata.
-- Vira soft-delete: o registro nunca some do banco por ação de usuário, só
-- fica marcado como excluído (oculto da timeline) — quem decide um expurgo
-- de verdade, depois do prazo legal, é um processo administrativo à parte,
-- não a action de excluir do dia a dia.
ALTER TABLE clinic_medical_records
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN clinic_medical_records.deleted_at IS
  'Soft-delete — retenção legal mínima de 20 anos (Resolução CFM 1.821/2007). Nunca apagar fisicamente via action de usuário.';
