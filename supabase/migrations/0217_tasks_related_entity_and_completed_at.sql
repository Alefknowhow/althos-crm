-- Tarefas: campo genérico "Relacionado a" (para tipos sem coluna dedicada)
-- + completed_at (data em que a tarefa foi marcada como concluída).
--
-- Abordagem híbrida: contato_id e sale_id continuam como estão (FKs reais,
-- dado de produção, UI já depende deles). Para os demais tipos de entidade
-- (cotação/travel_proposals, agendamento/appointments, venda genérica/sales,
-- negócio imobiliário/property_deals, proposta imobiliária/property_proposals)
-- usamos um par (related_entity_type, related_entity_id) sem FK — não é
-- possível criar uma FK real contra tabelas heterogêneas. Limitação aceita e
-- documentada, não um descuido.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS related_entity_type TEXT
    CHECK (related_entity_type IN ('travel_proposal','appointment','sale','property_deal','property_proposal'));

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS related_entity_id UUID;

CREATE INDEX IF NOT EXISTS idx_tasks_related_entity
  ON public.tasks(related_entity_type, related_entity_id)
  WHERE related_entity_type IS NOT NULL;

-- Backfill: sem updated_at nesta tabela, created_at é a melhor aproximação
-- disponível para completed_at em tarefas já concluídas — não é a data real
-- de conclusão, apenas um fallback razoável para não deixar tudo NULL.
UPDATE public.tasks
  SET completed_at = created_at
  WHERE status = 'done' AND completed_at IS NULL;
