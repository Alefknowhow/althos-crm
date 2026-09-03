-- Guarda o @usuário do Instagram diretamente no contato (não só na conversa
-- do inbox social), pra:
--   1) exibir/editar em Contatos > Dados do cliente, com link clicável;
--   2) servir de chave de dedup ao criar leads a partir do Instagram — evita
--      cadastrar a mesma pessoa de novo quando ela já tem um contato salvo
--      (manualmente ou de uma conversa anterior).
-- Normalizado sem "@" na coluna; a UI prefixa "@" na exibição.

ALTER TABLE contatos
  ADD COLUMN IF NOT EXISTS instagram_username TEXT;

-- Lookup case-insensitive por org — usado no fluxo de dedup do Instagram
-- (lib/social/engine.ts, actions/social-inbox.ts) antes de criar um lead novo.
CREATE INDEX IF NOT EXISTS idx_contatos_org_instagram_username
  ON contatos (organization_id, lower(instagram_username))
  WHERE instagram_username IS NOT NULL;

COMMENT ON COLUMN contatos.instagram_username IS
  '@usuário do Instagram do contato (sem o "@"), usado para exibição/link e para dedup de leads vindos do Instagram.';
