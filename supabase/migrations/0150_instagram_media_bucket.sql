-- Bucket público pra mídia enviada (imagem/áudio) no inbox manual do
-- Instagram — o uploadFormAsset existente só aceita imagem, e a API de
-- mensagens do Instagram baixa a mídia de uma URL pública.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'instagram-media',
  'instagram-media',
  true,
  20971520, -- 20 MB
  ARRAY['image/jpeg','image/png','image/webp','audio/ogg','audio/mpeg','audio/mp4','audio/aac']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Instagram media read public" ON storage.objects;
CREATE POLICY "Instagram media read public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'instagram-media');

-- Escrita só pelo service role (as actions usam createAdminClient).
