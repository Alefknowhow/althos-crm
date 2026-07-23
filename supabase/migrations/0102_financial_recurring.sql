-- Despesas recorrentes: lançamentos que se repetem todo mês (aluguel,
-- assinaturas, etc.). is_recurring marca o lançamento como parte de uma
-- série; recurrence_group_id agrupa todas as ocorrências da mesma série
-- (aponta pro id do lançamento original).
alter table financial_entries
  add column if not exists is_recurring boolean not null default false,
  add column if not exists recurrence_group_id uuid;

create index if not exists financial_entries_recurrence_idx on financial_entries(recurrence_group_id);
