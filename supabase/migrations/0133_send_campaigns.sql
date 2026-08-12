-- Campanhas de Envio: disparo em massa por WhatsApp (template aprovado) ou
-- e-mail, pra um público filtrado por tags e/ou estágio do pipeline.
-- Público é materializado na criação (1 linha por contato em
-- send_campaign_recipients), não resolvido em tempo de envio — dá um
-- número concreto de "quem vai receber" e torna cancelamento/auditoria
-- triviais. Um cron (lib/inngest/send-campaigns-cron.ts) processa a fila
-- em lotes pequenos por tick, mesmo padrão de scheduled_whatsapp_messages.

CREATE TABLE IF NOT EXISTS send_campaigns (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                  TEXT NOT NULL,
    channel               TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),

    -- WhatsApp: guarda o FK (pra UI) e um snapshot de nome/idioma (pra uma
    -- edição/remoção do template depois não quebrar um envio já em curso).
    wa_template_id        UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
    wa_template_name      TEXT,
    wa_template_language  TEXT,
    wa_header_type        TEXT,
    wa_header_media_url   TEXT,

    -- E-mail
    email_template_id     UUID REFERENCES email_templates(id) ON DELETE SET NULL,

    -- Definição do filtro de público (fica salva pra exibição/auditoria,
    -- mesmo com os destinatários já materializados à parte).
    audience_tags         TEXT[] NOT NULL DEFAULT '{}',
    audience_stage_ids    UUID[] NOT NULL DEFAULT '{}',
    audience_pipeline_id  UUID REFERENCES pipelines(id) ON DELETE SET NULL,

    status                TEXT NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'canceled')),
    scheduled_at          TIMESTAMPTZ,  -- null = enviar assim que materializado ("agora")
    started_at            TIMESTAMPTZ,
    completed_at          TIMESTAMPTZ,

    recipient_count       INTEGER NOT NULL DEFAULT 0,
    sent_count            INTEGER NOT NULL DEFAULT 0,
    failed_count          INTEGER NOT NULL DEFAULT 0,

    created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_send_campaigns_org_status
    ON send_campaigns(organization_id, status);

CREATE TABLE IF NOT EXISTS send_campaign_recipients (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id       UUID NOT NULL REFERENCES send_campaigns(id) ON DELETE CASCADE,
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contato_id        UUID REFERENCES contatos(id) ON DELETE SET NULL,

    -- Snapshot no momento da materialização.
    contact_name      TEXT,
    contact_phone     TEXT,
    contact_email     TEXT,

    wa_variables      JSONB NOT NULL DEFAULT '[]'::jsonb,
    email_variables   JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- 'skipped' = bateu no filtro mas não tem telefone/e-mail pro canal da campanha.
    status            TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
    sent_at           TIMESTAMPTZ,
    error             TEXT,
    meta_message_id   TEXT,
    resend_id         TEXT,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cron: reivindica lote pendente por campanha.
CREATE INDEX IF NOT EXISTS idx_send_campaign_recipients_campaign_status
    ON send_campaign_recipients(campaign_id, status);

-- Cron: scan global de pendentes pra decidir quais campanhas processar.
CREATE INDEX IF NOT EXISTS idx_send_campaign_recipients_org_pending
    ON send_campaign_recipients(organization_id, status)
    WHERE status = 'pending';

ALTER TABLE send_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE send_campaign_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Send campaigns access" ON send_campaigns;
CREATE POLICY "Send campaigns access" ON send_campaigns
    FOR ALL
    USING (organization_id IN (SELECT get_user_organizations()))
    WITH CHECK (organization_id IN (SELECT get_user_organizations()));

DROP POLICY IF EXISTS "Send campaign recipients access" ON send_campaign_recipients;
CREATE POLICY "Send campaign recipients access" ON send_campaign_recipients
    FOR ALL
    USING (organization_id IN (SELECT get_user_organizations()))
    WITH CHECK (organization_id IN (SELECT get_user_organizations()));
