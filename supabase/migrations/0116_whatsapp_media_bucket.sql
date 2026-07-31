-- Bucket público pra mídia recebida via WhatsApp (fotos, áudios, vídeos,
-- documentos, figurinhas). A API do WhatsApp só entrega um media_id com URL
-- temporária (expira em minutos) — o webhook baixa o arquivo e sobe aqui pra
-- ter uma URL permanente que o CRM consegue exibir depois.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-media',
  'whatsapp-media',
  true,
  20971520, -- 20 MB (cobre o limite de vídeo/documento do WhatsApp)
  ARRAY[
    'image/jpeg','image/png','image/webp','image/gif',
    'audio/aac','audio/mp4','audio/mpeg','audio/amr','audio/ogg','audio/opus',
    'video/mp4','video/3gpp',
    'application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Whatsapp media read public" ON storage.objects;
CREATE POLICY "Whatsapp media read public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'whatsapp-media');

-- Escrita só pelo service role (o webhook usa createAdminClient, que já
-- ignora RLS) — não expomos upload direto pra usuários autenticados aqui.
