-- Migração de avatares de contato pro Cloudflare R2 (primeiro fluxo
-- adotado na Storage Service). avatar_url (legado, Supabase Storage
-- público) continua existindo e funcionando pra fotos já enviadas antes
-- desta migração — é o modelo híbrido: contato antigo com avatar_url
-- preenchido e avatar_storage_object_id nulo segue mostrando a foto
-- normalmente. Upload NOVO passa a preencher avatar_storage_object_id
-- (R2, signed URL) e não usa mais avatar_url.
alter table public.contatos
  add column if not exists avatar_storage_object_id uuid references public.storage_objects(id) on delete set null;
