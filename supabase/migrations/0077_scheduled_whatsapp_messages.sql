-- Scheduled WhatsApp messages
-- Lets an agent compose a message in /conversas and have it delivered later.
-- A per-minute Inngest cron picks due rows and sends them, falling back to an
-- approved template when the 24h customer-service window has closed.

CREATE TABLE IF NOT EXISTS scheduled_whatsapp_messages (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    conversation_id      UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
    contato_id           UUID REFERENCES contatos(id) ON DELETE SET NULL,
    contact_phone        TEXT NOT NULL,

    -- Free-text body to deliver while inside the 24h window.
    body                 TEXT NOT NULL,

    -- When to deliver (UTC).
    send_at              TIMESTAMPTZ NOT NULL,

    -- pending -> sending (claimed by cron) -> sent | failed ; canceled by user.
    status               TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'canceled')),

    -- Optional approved template used when the 24h window is closed at delivery.
    fallback_template_id UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
    fallback_variables   JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Delivery bookkeeping.
    sent_at              TIMESTAMPTZ,
    sent_via             TEXT,            -- 'text' | 'template'
    error                TEXT,
    meta_message_id      TEXT,

    created_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cron scan: due pending rows.
CREATE INDEX IF NOT EXISTS idx_sched_wa_due
    ON scheduled_whatsapp_messages(status, send_at);

-- Inbox panel: pending rows per conversation.
CREATE INDEX IF NOT EXISTS idx_sched_wa_conversation
    ON scheduled_whatsapp_messages(conversation_id);

ALTER TABLE scheduled_whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Scheduled WA messages access" ON scheduled_whatsapp_messages;
CREATE POLICY "Scheduled WA messages access" ON scheduled_whatsapp_messages
    FOR ALL
    USING (organization_id IN (SELECT get_user_organizations()))
    WITH CHECK (organization_id IN (SELECT get_user_organizations()));
