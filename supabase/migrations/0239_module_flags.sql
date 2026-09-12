-- Módulos desativados globalmente por nicho (kill-switch de super-admin,
-- ver app/super-admin/modulos/). Generaliza o PRONTUARIO_ENABLED hardcoded
-- que já existia em lib/niche-modules.ts — o default abaixo preserva
-- exatamente o comportamento atual (Prontuário trancado).
insert into system_config (key, value, description)
values (
  'disabled_modules',
  '{"clinicas": ["prontuario_clinica"]}'::jsonb,
  'Módulos desativados globalmente por nicho (kill-switch de super-admin). Chave = NicheKey (lib/niche.ts), valor = array de ModuleKey (lib/niche-modules.ts) desativados nesse nicho.'
)
on conflict (key) do nothing;
