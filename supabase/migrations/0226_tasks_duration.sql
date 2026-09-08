-- Duração opcional da tarefa (em minutos) — permite usar Tarefas também
-- como agenda: na visão Semana, o bloco da tarefa passa a ocupar a altura
-- proporcional à duração em vez de só marcar o horário de início.
alter table tasks
  add column if not exists duration_minutes integer
    check (duration_minutes is null or duration_minutes > 0);
