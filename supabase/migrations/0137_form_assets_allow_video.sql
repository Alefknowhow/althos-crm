-- Bloco de vídeo em pergunta de formulário (Fase 3 do editor estilo
-- Typeform) — o bucket form-assets só aceitava imagem/PDF até aqui.
-- Sobe o limite pra acomodar o vídeo (30 MB em actions/upload.ts).

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml','application/pdf','video/mp4','video/webm','video/quicktime'],
  file_size_limit = 31457280 -- 30 MB
WHERE id = 'form-assets';
