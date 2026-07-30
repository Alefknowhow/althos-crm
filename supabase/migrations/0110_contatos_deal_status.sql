-- Separa o "status da negociação" (aberto/ganho/perdido/desqualificado) do
-- estágio do funil (contatos.stage_id). Até aqui, "fechado" só existia como
-- efeito colateral de pipeline_stages.is_won/is_lost — não havia um campo
-- próprio no lead. Esta migration introduz esse campo sem remover nada:
-- o pipeline continua sendo uma VISÃO (o board passa a filtrar por
-- deal_status = 'aberto'), o registro do lead nunca é apagado.
--
-- Nome escolhido: `deal_status`, não `status` — `contatos.status` já existe
-- e significa outra coisa (ciclo de vida do contato: lead/cliente/inativo).
-- Reaproveitar o nome "status" para o resultado da negociação colidiria
-- semanticamente com esse campo já em uso em toda a base.
--
-- Idempotente: pode rodar múltiplas vezes sem efeito colateral.

ALTER TABLE contatos
  ADD COLUMN IF NOT EXISTS deal_status TEXT NOT NULL DEFAULT 'aberto'
    CHECK (deal_status IN ('aberto', 'ganho', 'perdido', 'desqualificado')),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS close_reason TEXT,
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill: todo lead existente nasce 'aberto' (já é o DEFAULT do ADD COLUMN
-- acima para as linhas atuais), exceto os que já estão hoje num estágio
-- terminal (is_won/is_lost) — esses viram 'ganho'/'perdido' com closed_at
-- estimado a partir de updated_at, preservando o comportamento atual do
-- board (que hoje mostra esses cards nas colunas fechadas).
UPDATE contatos c
SET
  deal_status = CASE WHEN ps.is_won THEN 'ganho' ELSE 'perdido' END,
  closed_at = COALESCE(c.closed_at, c.updated_at)
FROM pipeline_stages ps
WHERE c.stage_id = ps.id
  AND (ps.is_won = true OR ps.is_lost = true)
  AND c.deal_status = 'aberto';

CREATE INDEX IF NOT EXISTS idx_contatos_deal_status
  ON contatos (organization_id, pipeline_id, deal_status);

COMMENT ON COLUMN contatos.deal_status IS
  'Status da negociação — separado do estágio do funil (stage_id). aberto = visível no board; ganho/perdido/desqualificado = fechado, sai do board mas o registro permanece pra sempre.';
COMMENT ON COLUMN contatos.close_reason IS
  'Motivo do fechamento. Obrigatório na prática para perdido/desqualificado (aplicado na camada de aplicação, não via CHECK, pra não travar dados legados).';
