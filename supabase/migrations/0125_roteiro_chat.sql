-- Roteirista vira chat multi-turno: cada roteiro_generations agora é uma
-- "conversa" (sessão), com as mensagens (usuário/IA) guardadas à parte.
-- O formulário de "Novo roteiro" continua existindo, mas só como atalho
-- pra compor a primeira mensagem — a conversa pode continuar depois.

CREATE TABLE IF NOT EXISTS roteiro_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    roteiro_id UUID NOT NULL REFERENCES roteiro_generations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roteiro_messages_roteiro_created
  ON roteiro_messages (roteiro_id, created_at);

ALTER TABLE roteiro_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roteiro_messages_org_access" ON roteiro_messages
  FOR ALL
  USING (organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid()));

-- Campos do formulário estruturado viram opcionais — a conversa pode
-- começar sem nenhum deles preenchidos (destino incluso, já que ele é
-- exibido na lista, mas passa a aceitar "Nova conversa" como valor).
ALTER TABLE roteiro_generations
  ALTER COLUMN destino DROP NOT NULL,
  ALTER COLUMN mode DROP NOT NULL;
