-- Issue #18 ("Agentes IA como etapas conversacionais do Workflow") — ação
-- "Iniciar/atribuir conversa a Agente IA": permite que uma automação
-- substitua, POR CONVERSA, qual Agent Definition (issue #19) conduz o
-- atendimento no WhatsApp, com um objetivo específico da execução —
-- sem duplicar personalidade/prompt (que continuam só em
-- agent_definitions) e sem mexer na atribuição padrão por cenário
-- (agent_assignments, que continua valendo pra toda conversa sem override).
alter table public.whatsapp_conversations
  add column if not exists assigned_agent_definition_id uuid references public.agent_definitions(id) on delete set null,
  add column if not exists assigned_agent_objective text,
  add column if not exists assigned_agent_source text,
  add column if not exists assigned_agent_started_at timestamptz;

create index if not exists idx_whatsapp_conversations_assigned_agent
  on public.whatsapp_conversations(assigned_agent_definition_id)
  where assigned_agent_definition_id is not null;
