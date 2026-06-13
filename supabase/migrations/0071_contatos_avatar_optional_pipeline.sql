-- =====================================================================
-- Contatos: pipeline opcional + foto (avatar)
--
-- 1) Um contato não precisa mais estar num funil. Ao cadastrar um contato
--    direto na tela de Contatos (sem passar pelo pipeline), pipeline_id e
--    stage_id ficam nulos. O board de pipeline simplesmente não exibe
--    contatos sem stage_id.
-- 2) Foto do contato (avatar_url) — aponta para um objeto no bucket público
--    'contato-avatars'. Público para carregar rápido na lista (master-detail),
--    mesmo padrão dos logos de org; o caminho usa UUIDs não-adivinháveis.
-- =====================================================================

-- 1) Pipeline/stage agora são opcionais.
ALTER TABLE contatos ALTER COLUMN pipeline_id DROP NOT NULL;
ALTER TABLE contatos ALTER COLUMN stage_id DROP NOT NULL;

-- 2) Avatar.
ALTER TABLE contatos ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 3) Bucket público para fotos de contato.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contato-avatars',
  'contato-avatars',
  TRUE,  -- público: avatares aparecem na lista inteira
  5 * 1024 * 1024, -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Path layout: `{org_id}/{contato_id}/{filename}`.
-- Leitura pública (qualquer um com a URL exata); escrita só na pasta da própria org.
DROP POLICY IF EXISTS "Contato avatars read public" ON storage.objects;
CREATE POLICY "Contato avatars read public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contato-avatars');

DROP POLICY IF EXISTS "Contato avatars insert own org" ON storage.objects;
CREATE POLICY "Contato avatars insert own org"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'contato-avatars'
    AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
  );

DROP POLICY IF EXISTS "Contato avatars update own org" ON storage.objects;
CREATE POLICY "Contato avatars update own org"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'contato-avatars'
    AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
  );

DROP POLICY IF EXISTS "Contato avatars delete own org" ON storage.objects;
CREATE POLICY "Contato avatars delete own org"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'contato-avatars'
    AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_organizations())
  );
