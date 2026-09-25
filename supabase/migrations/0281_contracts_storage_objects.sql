-- Correção da 0280: uploads novos passam por StorageService (R2) e
-- storage_objects, nunca um path de bucket bruto (esse é o padrão legado de
-- sale_contracts/plan_contracts, que ainda usam buckets Supabase dedicados —
-- não replicar aqui). Referencia storage_objects(id); a URL de leitura é
-- resolvida sob demanda via getObjectSignedUrl(orgSlug, objectId).
alter table public.contracts
  drop column if exists pdf_path,
  drop column if exists signed_pdf_path,
  add column if not exists pdf_storage_object_id uuid references public.storage_objects(id) on delete set null,
  add column if not exists signed_pdf_storage_object_id uuid references public.storage_objects(id) on delete set null;
