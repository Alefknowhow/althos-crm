-- ---------------------------------------------------------------------------
-- 0056_whatsapp_connections
--
-- Foundation for two WhatsApp "modules" living side by side under ONE
-- abstraction, so the rest of the app (Conversas, Automações, Atendente IA)
-- never has to know which transport is used:
--
--   * 'cloud_api' — official Meta Cloud API (what exists today, stored as
--                   loose columns on organizations).
--   * 'qr'        — unofficial WhatsApp Web session (login via QR code),
--                   driven by a self-hosted gateway. No template support.
--
-- Decision: ONE active connection per organization (cloud_api OR qr), so a
-- partial unique index enforces a single non-disabled row per org.
--
-- This migration is ADDITIVE and NON-DESTRUCTIVE: the legacy
-- organizations.whatsapp_* columns keep working, and existing orgs are
-- backfilled into a 'cloud_api' connection row so nothing breaks.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- which module this connection is
  provider         TEXT        NOT NULL CHECK (provider IN ('cloud_api', 'qr')),

  -- lifecycle: 'disconnected' (idle), 'pending' (waiting QR scan / setup),
  -- 'connected' (ready to send), 'error' (token expired / session dropped)
  status           TEXT        NOT NULL DEFAULT 'disconnected'
                     CHECK (status IN ('disconnected', 'pending', 'connected', 'error')),

  -- a connection can be turned off without being deleted (keeps history/session)
  is_enabled       BOOLEAN     NOT NULL DEFAULT TRUE,

  -- human label + the resolved E.164 number once connected
  display_name     TEXT,
  phone_number     TEXT,

  -- ── cloud_api credentials (mirror of the legacy columns) ──────────────
  phone_number_id  TEXT,
  access_token     TEXT,

  -- ── qr / gateway binding (no secrets from the Meta side) ──────────────
  -- instance/session identifier on the self-hosted gateway + last QR payload
  gateway_instance TEXT,
  qr_code          TEXT,        -- last QR string/dataURL to render in the CRM
  session_json     JSONB,       -- opaque session blob if we ever persist it here

  -- observability
  last_connected_at TIMESTAMPTZ,
  last_error        TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One ENABLED connection per org (the "active" WhatsApp). Disabled rows are
-- allowed to linger (e.g. an old QR session kept for reference).
CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_connections_org_enabled
  ON public.whatsapp_connections (organization_id)
  WHERE is_enabled;

CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_org
  ON public.whatsapp_connections (organization_id);

-- Gateway webhooks arrive keyed by instance id → fast lookup.
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_gateway_instance
  ON public.whatsapp_connections (gateway_instance)
  WHERE gateway_instance IS NOT NULL;

-- ── Tie conversations + messages to the connection they came through ──────
-- Nullable: legacy rows predate connections; resolved lazily / by backfill.
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS connection_id UUID
    REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS connection_id UUID
    REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL;

-- ── RLS: org members read their connections; writes are service-role only ─
-- (saving credentials / driving QR happens through server actions that use
--  the service-role or RLS-scoped client with explicit org checks).
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_read_wa_connections" ON public.whatsapp_connections;
CREATE POLICY "org_members_read_wa_connections"
  ON public.whatsapp_connections FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );

-- ── Backfill: every org that already has Cloud API creds becomes a
--    'cloud_api' connection. Idempotent via NOT EXISTS guard. ──────────────
INSERT INTO public.whatsapp_connections
  (organization_id, provider, status, phone_number_id, access_token, display_name)
SELECT
  o.id,
  'cloud_api',
  CASE WHEN o.whatsapp_access_token = 'mock' THEN 'disconnected' ELSE 'connected' END,
  o.whatsapp_phone_number_id,
  o.whatsapp_access_token,
  'WhatsApp Oficial'
FROM public.organizations o
WHERE o.whatsapp_phone_number_id IS NOT NULL
  AND o.whatsapp_access_token IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.whatsapp_connections c
    WHERE c.organization_id = o.id
  );

-- Link pre-existing conversations to their org's (single) connection.
UPDATE public.whatsapp_conversations conv
SET connection_id = c.id
FROM public.whatsapp_connections c
WHERE conv.connection_id IS NULL
  AND c.organization_id = conv.organization_id
  AND c.is_enabled;
