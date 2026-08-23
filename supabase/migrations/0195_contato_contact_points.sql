-- Refatoração da tela de Contatos: suporte a múltiplos e-mails/telefones por
-- contato (ex.: "Trabalho"/"Pessoal"), além do e-mail/telefone principal já
-- existente em contatos.email/contatos.phone (mantidos como estão — são
-- usados em busca, vínculo de WhatsApp, etc., não são substituídos).
--
-- Esta tabela guarda só os pontos de contato ADICIONAIS, com um rótulo livre.

CREATE TABLE IF NOT EXISTS contato_contact_points (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contato_id      UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL CHECK (kind IN ('email', 'phone')),
    label           TEXT,
    value           TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contato_contact_points_contato ON contato_contact_points (contato_id);
CREATE INDEX IF NOT EXISTS idx_contato_contact_points_org ON contato_contact_points (organization_id);

ALTER TABLE contato_contact_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contact points access" ON contato_contact_points
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
CREATE POLICY "Contact points super admin" ON contato_contact_points
  FOR ALL USING ((SELECT is_super_admin()));
