-- Cadastro base do profissional passa a ser feito em "Contatos" (nome, foto,
-- telefone, e-mail, demais dados pessoais) — clinic_professionals vira o
-- VÍNCULO clínico (especialidade, registro, comissão) sobre um contato.
-- Profissionais já cadastrados sem contato_id continuam funcionando com os
-- campos próprios (name/phone/email/avatar_storage_object_id) como fallback
-- — não força migração de dado existente.
ALTER TABLE clinic_professionals
  ADD COLUMN IF NOT EXISTS contato_id UUID REFERENCES contatos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clinic_professionals_contato ON clinic_professionals (contato_id);

COMMENT ON COLUMN clinic_professionals.contato_id IS 'Contato que é a fonte de verdade do cadastro pessoal (nome/foto/telefone/e-mail) deste profissional. Quando null, usa os campos legados da própria linha (name/phone/email/avatar_storage_object_id).';
