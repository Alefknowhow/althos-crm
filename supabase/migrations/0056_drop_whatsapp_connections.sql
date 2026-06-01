-- ---------------------------------------------------------------------------
-- 0056_drop_whatsapp_connections
--
-- The two-module WhatsApp idea (official Cloud API + unofficial QR) was
-- dropped: we are staying 100% on the official Meta Cloud API to avoid the
-- ban risk and ToS violation of QR/WhatsApp-Web automation.
--
-- This rolls back the (empty) whatsapp_connections foundation. The table never
-- held data (backfill produced 0 rows), so the drop is lossless. The official
-- credentials continue to live on organizations.whatsapp_* as before.
-- ---------------------------------------------------------------------------

ALTER TABLE public.whatsapp_messages      DROP COLUMN IF EXISTS connection_id;
ALTER TABLE public.whatsapp_conversations DROP COLUMN IF EXISTS connection_id;

DROP TABLE IF EXISTS public.whatsapp_connections;
