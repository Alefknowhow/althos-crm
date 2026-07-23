-- Redesenho das automações do Instagram: um único configurador (estilo
-- ManyChat) cobrindo todos os tipos de gatilho — o "canal" (DM, comentário,
-- comentário+DM, story, resposta de story) vira só mais um valor de
-- trigger_type, e cada passo pode carregar botões (resposta rápida ou link).
alter table social_funnels drop constraint if exists social_funnels_trigger_type_check;
alter table social_funnels add constraint social_funnels_trigger_type_check
  check (trigger_type in ('dm', 'comment', 'comment_and_dm', 'story', 'story_reply'));

alter table social_funnel_steps
  add column if not exists buttons jsonb not null default '[]'::jsonb;

comment on column social_funnel_steps.buttons is
  'Array de botões anexados à mensagem do passo: [{"type":"reply"|"link","label":"...","value":"..."}]. reply = resposta rápida (o valor vira o texto enviado de volta); link = abre a URL em value.';
