-- Cor compartilhada entre a criação, edição e timeline de tarefas.
-- Nullable para compatibilidade com integrações antigas; a interface usa azul como fallback.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS color text DEFAULT 'blue'
  CONSTRAINT tasks_color_check CHECK (
    color IN ('blue', 'indigo', 'violet', 'pink', 'red', 'orange', 'amber', 'green', 'teal', 'cyan')
  );
