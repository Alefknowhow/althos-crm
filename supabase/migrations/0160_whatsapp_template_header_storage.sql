-- Migração da mídia de cabeçalho de template do WhatsApp pro R2.
--
-- Diferente de avatar/anexo/mídia de mensagem: header_media_url aqui é
-- reusado por prazo INDEFINIDO — automação (lib/inngest/automation.ts)
-- guarda a config do step pra sempre, campanha em massa
-- (send-campaigns-cron.ts) reprocessa a mesma campanha por dias, e
-- mensagem agendada pode ser resolvida meses depois. Uma signed URL de
-- 48h embutida em qualquer um desses lugares expiraria no meio do
-- caminho. Por isso a coluna nova guarda uma REFERÊNCIA estável
-- (storage_objects.id), nunca a URL em si — cada ponto de envio real
-- (submitWaTemplateToMeta, send-campaigns-cron, scheduled-delivery,
-- automation.ts) resolve uma signed URL fresca só na hora de mandar pra
-- Meta, via lib/storage/system.ts::resolveSystemSignedUrl (cache-aware,
-- mesma lógica de cache de 48h já usada no resto da Storage Service).
--
-- header_media_url (legado, Supabase Storage) continua existindo pro
-- modelo híbrido — template antigo sem header_storage_object_id
-- continua funcionando como hoje.
alter table public.whatsapp_templates
  add column if not exists header_storage_object_id uuid references public.storage_objects(id) on delete set null;

alter table public.send_campaigns
  add column if not exists wa_header_storage_object_id uuid references public.storage_objects(id) on delete set null;
