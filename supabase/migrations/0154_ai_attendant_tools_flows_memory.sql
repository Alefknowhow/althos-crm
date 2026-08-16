-- Dá conteúdo real às 3 abas "Em breve" do Agente IA (Fluxos, Ferramentas,
-- Memória) — evita deixar configuração fingindo um recurso que não existe.

-- Ferramentas: quais tools o agente pode chamar (subconjunto de
-- ATTENDANT_TOOLS, lib/ai/attendant-tools.ts). NULL = todas habilitadas
-- (comportamento anterior, preservado pra quem já usa).
alter table public.ai_attendant_config
  add column if not exists enabled_tools text[];

-- Fluxos: roteiro guiado — lista ordenada de passos/instruções que entram
-- no prompt como sugestão de condução da conversa (não é uma máquina de
-- estado determinística; é uma reformulação estruturada do que hoje só dá
-- pra escrever solto dentro da Persona).
alter table public.ai_attendant_config
  add column if not exists guided_steps jsonb not null default '[]'::jsonb;

-- Memória: liga/desliga o uso de notas entre conversas diferentes do mesmo
-- lead (ver contatos.ai_memory_notes abaixo).
alter table public.ai_attendant_config
  add column if not exists memory_enabled boolean not null default true;

-- Nota de memória por lead — atualizada pela IA a cada handoff (mesmo texto
-- que já alimenta o resumo pro humano), consultada nas próximas conversas
-- desse mesmo contato pra não repetir perguntas já respondidas antes.
alter table public.contatos
  add column if not exists ai_memory_notes text;
