-- 0070: Unificação leads + clientes -> "contatos"
-- =====================================================================
-- Objetivo: uma única entidade de contato. "cliente" deixa de ser uma
-- aba/objeto separado e passa a ser um STATUS do contato. Os dados que
-- viviam em customer_profiles (CPF, endereço, passaporte...) passam a ser
-- colunas de contatos. Documentos e o restante das tabelas passam a
-- referenciar contato_id. Adiciona parentesco (contato_relationships).
--
-- Nomenclatura unificada (tabelas/colunas/índices/constraints/policies/
-- funções) para "contato", para facilitar manutenção futura.
--
-- Pré-condição: banco São Paulo (boggtwpywbkpzkmvnbng), sem dados reais.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Renomear tabelas centrais
-- ---------------------------------------------------------------------
ALTER TABLE public.leads              RENAME TO contatos;
ALTER TABLE public.lead_activities    RENAME TO contato_activities;
ALTER TABLE public.customer_documents RENAME TO contato_documents;

-- ---------------------------------------------------------------------
-- 2. contatos.status (lead/cliente/inativo) substitui is_customer
-- ---------------------------------------------------------------------
ALTER TABLE public.contatos
  ADD COLUMN status TEXT NOT NULL DEFAULT 'lead'
  CHECK (status IN ('lead', 'cliente', 'inativo'));

UPDATE public.contatos SET status = 'cliente' WHERE is_customer = TRUE;

DROP INDEX IF EXISTS public.idx_leads_org_is_customer;
ALTER TABLE public.contatos DROP COLUMN is_customer;

CREATE INDEX idx_contatos_org_status ON public.contatos (organization_id, status);

-- ---------------------------------------------------------------------
-- 3. contatos absorve as colunas de customer_profiles (dados de cliente)
-- ---------------------------------------------------------------------
ALTER TABLE public.contatos
  ADD COLUMN cpf             TEXT,
  ADD COLUMN rg              TEXT,
  ADD COLUMN date_of_birth   DATE,
  ADD COLUMN postal_code     TEXT,
  ADD COLUMN street          TEXT,
  ADD COLUMN number          TEXT,
  ADD COLUMN complement      TEXT,
  ADD COLUMN district        TEXT,
  ADD COLUMN city            TEXT,
  ADD COLUMN state           TEXT,
  ADD COLUMN country         TEXT DEFAULT 'BR',
  ADD COLUMN address_notes   TEXT,
  ADD COLUMN passport_number TEXT,
  ADD COLUMN passport_expiry DATE,
  ADD COLUMN has_us_visa     BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill 1:1 (customer_profiles.lead_id == contatos.id)
UPDATE public.contatos c
SET cpf             = cp.cpf,
    rg              = cp.rg,
    date_of_birth   = cp.date_of_birth,
    postal_code     = cp.postal_code,
    street          = cp.street,
    number          = cp.number,
    complement      = cp.complement,
    district        = cp.district,
    city            = cp.city,
    state           = cp.state,
    country         = COALESCE(cp.country, 'BR'),
    address_notes   = cp.notes,
    passport_number = cp.passport_number,
    passport_expiry = cp.passport_expiry,
    has_us_visa     = cp.has_us_visa
FROM public.customer_profiles cp
WHERE cp.lead_id = c.id;

CREATE INDEX idx_contatos_city ON public.contatos (organization_id, city);

-- ---------------------------------------------------------------------
-- 4. contato_documents passa a referenciar contato_id
-- ---------------------------------------------------------------------
ALTER TABLE public.contato_documents ADD COLUMN contato_id UUID;

UPDATE public.contato_documents d
SET contato_id = cp.lead_id
FROM public.customer_profiles cp
WHERE d.customer_profile_id = cp.id;

ALTER TABLE public.contato_documents ALTER COLUMN contato_id SET NOT NULL;
ALTER TABLE public.contato_documents DROP COLUMN customer_profile_id; -- remove a FK p/ customer_profiles
ALTER TABLE public.contato_documents
  ADD CONSTRAINT contato_documents_contato_id_fkey
  FOREIGN KEY (contato_id) REFERENCES public.contatos(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS public.idx_customer_documents_profile;
CREATE INDEX idx_contato_documents_contato ON public.contato_documents (contato_id);
ALTER TABLE public.contato_documents RENAME CONSTRAINT customer_documents_pkey TO contato_documents_pkey;
ALTER POLICY "Customer documents access" ON public.contato_documents RENAME TO "Contato documents access";

-- ---------------------------------------------------------------------
-- 5. Eliminar customer_profiles (dados já migrados para contatos)
-- ---------------------------------------------------------------------
DROP TABLE public.customer_profiles;

-- ---------------------------------------------------------------------
-- 6. Renomear lead_id -> contato_id em todas as tabelas referenciadas
-- ---------------------------------------------------------------------
ALTER TABLE public.appointments          RENAME COLUMN lead_id TO contato_id;
ALTER TABLE public.automation_runs        RENAME COLUMN lead_id TO contato_id;
ALTER TABLE public.email_sends            RENAME COLUMN lead_id TO contato_id;
ALTER TABLE public.form_submissions       RENAME COLUMN lead_id TO contato_id;
ALTER TABLE public.sales                  RENAME COLUMN lead_id TO contato_id;
ALTER TABLE public.social_interactions    RENAME COLUMN lead_id TO contato_id;
ALTER TABLE public.tasks                  RENAME COLUMN lead_id TO contato_id;
ALTER TABLE public.travel_proposals       RENAME COLUMN lead_id TO contato_id;
ALTER TABLE public.travel_sales           RENAME COLUMN lead_id TO contato_id;
ALTER TABLE public.whatsapp_conversations RENAME COLUMN lead_id TO contato_id;
ALTER TABLE public.contato_activities     RENAME COLUMN lead_id TO contato_id;
ALTER TABLE public.ai_credit_transactions RENAME COLUMN lead_id TO contato_id; -- coluna de auditoria (sem FK)

-- FK constraints renomeadas
ALTER TABLE public.appointments          RENAME CONSTRAINT appointments_lead_id_fkey          TO appointments_contato_id_fkey;
ALTER TABLE public.automation_runs        RENAME CONSTRAINT automation_runs_lead_id_fkey        TO automation_runs_contato_id_fkey;
ALTER TABLE public.email_sends            RENAME CONSTRAINT email_sends_lead_id_fkey            TO email_sends_contato_id_fkey;
ALTER TABLE public.form_submissions       RENAME CONSTRAINT form_submissions_lead_id_fkey       TO form_submissions_contato_id_fkey;
ALTER TABLE public.sales                  RENAME CONSTRAINT sales_lead_id_fkey                  TO sales_contato_id_fkey;
ALTER TABLE public.social_interactions    RENAME CONSTRAINT social_interactions_lead_id_fkey    TO social_interactions_contato_id_fkey;
ALTER TABLE public.tasks                  RENAME CONSTRAINT tasks_lead_id_fkey                  TO tasks_contato_id_fkey;
ALTER TABLE public.travel_proposals       RENAME CONSTRAINT travel_proposals_lead_id_fkey       TO travel_proposals_contato_id_fkey;
ALTER TABLE public.travel_sales           RENAME CONSTRAINT travel_sales_lead_id_fkey           TO travel_sales_contato_id_fkey;
ALTER TABLE public.whatsapp_conversations RENAME CONSTRAINT whatsapp_conversations_lead_id_fkey TO whatsapp_conversations_contato_id_fkey;
ALTER TABLE public.contato_activities     RENAME CONSTRAINT lead_activities_lead_id_fkey         TO contato_activities_contato_id_fkey;

-- Índices em lead_id renomeados
ALTER INDEX public.idx_appointments_lead       RENAME TO idx_appointments_contato;
ALTER INDEX public.idx_automation_runs_org_lead RENAME TO idx_automation_runs_org_contato;
ALTER INDEX public.idx_sales_lead              RENAME TO idx_sales_contato;
ALTER INDEX public.idx_social_interactions_lead RENAME TO idx_social_interactions_contato;
ALTER INDEX public.idx_travel_proposals_lead    RENAME TO idx_travel_proposals_contato;
ALTER INDEX public.idx_travel_sales_lead        RENAME TO idx_travel_sales_contato;

-- ---------------------------------------------------------------------
-- 7. Renomear PK/índices/policies das tabelas centrais
-- ---------------------------------------------------------------------
ALTER TABLE public.contatos RENAME CONSTRAINT leads_pkey TO contatos_pkey;
ALTER INDEX public.idx_leads_created_at     RENAME TO idx_contatos_created_at;
ALTER INDEX public.idx_leads_last_activity  RENAME TO idx_contatos_last_activity;
ALTER INDEX public.idx_leads_org_created_at RENAME TO idx_contatos_org_created_at;
ALTER INDEX public.idx_leads_org_email      RENAME TO idx_contatos_org_email;
ALTER INDEX public.idx_leads_org_id         RENAME TO idx_contatos_org_id;
ALTER INDEX public.idx_leads_org_score      RENAME TO idx_contatos_org_score;
ALTER POLICY "Leads access" ON public.contatos RENAME TO "Contatos access";

ALTER TABLE public.contato_activities RENAME CONSTRAINT lead_activities_pkey TO contato_activities_pkey;
ALTER INDEX public.idx_lead_activities_created_at   RENAME TO idx_contato_activities_created_at;
ALTER INDEX public.idx_lead_activities_lead_created RENAME TO idx_contato_activities_contato_created;
ALTER INDEX public.idx_lead_activities_org_id       RENAME TO idx_contato_activities_org_id;
ALTER POLICY "Lead activities access" ON public.contato_activities RENAME TO "Contato activities access";

-- ---------------------------------------------------------------------
-- 8. Triggers
-- ---------------------------------------------------------------------
ALTER TRIGGER update_leads_updated_at   ON public.contatos           RENAME TO update_contatos_updated_at;
ALTER TRIGGER update_lead_last_activity ON public.contato_activities RENAME TO update_contato_last_activity;

-- ---------------------------------------------------------------------
-- 9. Funções que referenciam leads/lead_id por nome (reescritas)
-- ---------------------------------------------------------------------

-- 9.1 Promoção automática a cliente quando uma venda é concluída (trigger em sales)
CREATE OR REPLACE FUNCTION public.auto_promote_to_customer()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.contato_id IS NOT NULL AND NEW.status = 'completed' THEN
    UPDATE public.contatos
    SET status = 'cliente',
        became_customer_at = COALESCE(became_customer_at, NOW()),
        updated_at = NOW()
    WHERE id = NEW.contato_id
      AND organization_id = NEW.organization_id
      AND status <> 'cliente';
  END IF;
  RETURN NEW;
END;
$function$;

-- 9.2 last_activity_at do contato (trigger em contato_activities)
CREATE OR REPLACE FUNCTION public.trg_update_lead_last_activity()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  UPDATE public.contatos
  SET    last_activity_at = NEW.created_at
  WHERE  id = NEW.contato_id
    AND  (last_activity_at IS NULL OR last_activity_at < NEW.created_at);
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.trg_update_lead_last_activity() RENAME TO trg_update_contato_last_activity;

-- 9.3 dashboard_funnel (2 sobrecargas)
CREATE OR REPLACE FUNCTION public.dashboard_funnel(p_org_id uuid, p_pipeline_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(stage_id uuid, name text, stage_position integer, count bigint)
LANGUAGE sql STABLE AS $function$
  SELECT s.id AS stage_id, s.name, s.position AS stage_position, COUNT(l.id)::BIGINT AS count
  FROM pipeline_stages s
  LEFT JOIN public.contatos l
    ON l.stage_id = s.id AND l.organization_id = p_org_id
  WHERE s.pipeline_id IN (
    SELECT id FROM pipelines
    WHERE organization_id = p_org_id
      AND (p_pipeline_id IS NULL OR id = p_pipeline_id)
  )
  GROUP BY s.id, s.name, s.position
  ORDER BY s.position;
$function$;

CREATE OR REPLACE FUNCTION public.dashboard_funnel(p_org_id uuid)
RETURNS TABLE(stage_id uuid, name text, stage_position integer, count bigint)
LANGUAGE sql STABLE AS $function$
  SELECT s.id AS stage_id, s.name, s.position AS stage_position, COUNT(l.id)::BIGINT AS count
  FROM pipeline_stages s
  LEFT JOIN public.contatos l
    ON l.stage_id = s.id AND l.organization_id = p_org_id
  WHERE s.pipeline_id IN (SELECT id FROM pipelines WHERE organization_id = p_org_id)
  GROUP BY s.id, s.name, s.position
  ORDER BY s.position;
$function$;

-- 9.4 dashboard_lead_sources (2 sobrecargas) — nome mantido p/ não quebrar rpc()
CREATE OR REPLACE FUNCTION public.dashboard_lead_sources(p_org_id uuid, p_start timestamp with time zone)
RETURNS TABLE(name text, value bigint)
LANGUAGE sql STABLE AS $function$
  SELECT COALESCE(source, 'Não informado') AS name, COUNT(*)::BIGINT AS value
  FROM public.contatos
  WHERE organization_id = p_org_id
    AND created_at >= p_start
  GROUP BY COALESCE(source, 'Não informado')
  ORDER BY value DESC;
$function$;

CREATE OR REPLACE FUNCTION public.dashboard_lead_sources(p_org_id uuid, p_start timestamp with time zone, p_pipeline_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(name text, value bigint)
LANGUAGE sql STABLE AS $function$
  SELECT COALESCE(source, 'Não informado') AS name, COUNT(*)::BIGINT AS value
  FROM public.contatos
  WHERE organization_id = p_org_id
    AND created_at >= p_start
    AND (p_pipeline_id IS NULL OR pipeline_id = p_pipeline_id)
  GROUP BY COALESCE(source, 'Não informado')
  ORDER BY value DESC;
$function$;

-- 9.5 dashboard_leads_timeseries (2 sobrecargas)
CREATE OR REPLACE FUNCTION public.dashboard_leads_timeseries(p_org_id uuid, p_start timestamp with time zone)
RETURNS TABLE(bucket date, stage_id uuid, stage_name text, count bigint)
LANGUAGE sql STABLE AS $function$
  SELECT
    (l.created_at AT TIME ZONE 'UTC')::DATE AS bucket,
    l.stage_id,
    s.name AS stage_name,
    COUNT(*)::BIGINT AS count
  FROM public.contatos l
  LEFT JOIN pipeline_stages s ON s.id = l.stage_id
  WHERE l.organization_id = p_org_id
    AND l.created_at >= p_start
  GROUP BY bucket, l.stage_id, s.name
  ORDER BY bucket;
$function$;

CREATE OR REPLACE FUNCTION public.dashboard_leads_timeseries(p_org_id uuid, p_start timestamp with time zone, p_pipeline_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(bucket date, stage_id uuid, stage_name text, count bigint)
LANGUAGE sql STABLE AS $function$
  SELECT
    (l.created_at AT TIME ZONE 'UTC')::DATE AS bucket,
    l.stage_id,
    s.name AS stage_name,
    COUNT(*)::BIGINT AS count
  FROM public.contatos l
  LEFT JOIN pipeline_stages s ON s.id = l.stage_id
  WHERE l.organization_id = p_org_id
    AND l.created_at >= p_start
    AND (p_pipeline_id IS NULL OR l.pipeline_id = p_pipeline_id)
  GROUP BY bucket, l.stage_id, s.name
  ORDER BY bucket;
$function$;

-- 9.6 dashboard_revenue (2 sobrecargas)
CREATE OR REPLACE FUNCTION public.dashboard_revenue(p_org_id uuid, p_stage_id uuid, p_start timestamp with time zone)
RETURNS bigint LANGUAGE sql STABLE AS $function$
  SELECT COALESCE(SUM(value_cents), 0)::BIGINT
  FROM public.contatos
  WHERE organization_id = p_org_id
    AND stage_id = p_stage_id
    AND updated_at >= p_start;
$function$;

CREATE OR REPLACE FUNCTION public.dashboard_revenue(p_org_id uuid, p_stage_id uuid, p_start timestamp with time zone, p_pipeline_id uuid DEFAULT NULL::uuid)
RETURNS bigint LANGUAGE sql STABLE AS $function$
  SELECT COALESCE(SUM(l.value_cents), 0)::BIGINT
  FROM public.contatos l
  WHERE l.organization_id = p_org_id
    AND l.stage_id = p_stage_id
    AND l.updated_at >= p_start
    AND (p_pipeline_id IS NULL OR l.pipeline_id = p_pipeline_id);
$function$;

-- 9.7 get_org_usage — leads_total/leads_month passam a contar contatos
CREATE OR REPLACE FUNCTION public.get_org_usage(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org        organizations%ROWTYPE;
  v_period     text := to_char(now(), 'YYYY-MM');
  v_month_start timestamptz := date_trunc('month', now());
  v_leads_total   integer;
  v_leads_month   integer;
  v_members       integer;
  v_wa_out_month  integer;
  v_email_month   integer;
  v_tasks_open    integer;
  v_credits       jsonb;
BEGIN
  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  IF v_org.id IS NULL THEN
    RETURN jsonb_build_object('error', 'org_not_found');
  END IF;
  SELECT count(*) INTO v_leads_total FROM contatos WHERE organization_id = p_org_id;
  SELECT count(*) INTO v_leads_month FROM contatos
    WHERE organization_id = p_org_id AND created_at >= v_month_start;
  SELECT count(*) INTO v_members FROM memberships WHERE organization_id = p_org_id;
  SELECT count(*) INTO v_wa_out_month FROM whatsapp_messages
    WHERE organization_id = p_org_id AND direction = 'outbound' AND created_at >= v_month_start;
  SELECT count(*) INTO v_email_month FROM email_sends
    WHERE organization_id = p_org_id AND created_at >= v_month_start;
  SELECT count(*) INTO v_tasks_open FROM tasks
    WHERE organization_id = p_org_id AND status <> 'done';
  SELECT jsonb_build_object(
           'included',  COALESCE(c.credits_included, 0),
           'purchased', COALESCE(c.credits_purchased, 0),
           'used',      COALESCE(c.credits_used, 0),
           'remaining', COALESCE(c.credits_included + c.credits_purchased - c.credits_used, 0),
           'period',    v_period
         )
    INTO v_credits
    FROM ai_credits c
   WHERE c.account_id = v_org.account_id AND c.period_month = v_period;
  RETURN jsonb_build_object(
    'org_id', p_org_id, 'account_id', v_org.account_id, 'plan', v_org.plan,
    'status', v_org.subscription_status, 'period', v_period,
    'usage', jsonb_build_object(
      'leads_total', v_leads_total, 'leads_month', v_leads_month, 'members', v_members,
      'whatsapp_month', v_wa_out_month, 'email_month', v_email_month, 'tasks_open', v_tasks_open),
    'limits', jsonb_build_object(
      'leads', v_org.limit_leads, 'whatsapp_monthly', v_org.limit_whatsapp_monthly,
      'email_monthly', v_org.limit_email_monthly, 'users', v_org.limit_users),
    'ai_credits', COALESCE(v_credits, jsonb_build_object(
      'included', 0, 'purchased', 0, 'used', 0, 'remaining', 0, 'period', v_period))
  );
END;
$function$;

-- 9.8 consume_ai_credits — ai_credit_transactions.contato_id (param p_lead_id mantido)
CREATE OR REPLACE FUNCTION public.consume_ai_credits(p_account_id uuid, p_action text, p_credits integer, p_lead_id uuid DEFAULT NULL::uuid, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_period     text := to_char(now(), 'YYYY-MM');
  v_credit_row ai_credits%ROWTYPE;
  v_available  integer;
BEGIN
  IF current_user_is_super_admin() THEN
    RETURN jsonb_build_object('success', true, 'credits_used', 0, 'remaining', 999999, 'bypass', true);
  END IF;
  INSERT INTO ai_credits (account_id, period_month, credits_included, reset_at)
  SELECT p_account_id, v_period,
    COALESCE((SELECT pl.ai_credits_monthly FROM plans pl
                JOIN subscriptions s ON s.plan_id = pl.id
               WHERE s.account_id = p_account_id AND s.status IN ('active','trialing') LIMIT 1), 0),
    date_trunc('month', now()) + interval '1 month'
  ON CONFLICT (account_id, period_month) DO NOTHING;
  SELECT * INTO v_credit_row FROM ai_credits
   WHERE account_id = p_account_id AND period_month = v_period FOR UPDATE;
  v_available := v_credit_row.credits_included + v_credit_row.credits_purchased - v_credit_row.credits_used;
  IF v_available < p_credits THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits', 'available', v_available);
  END IF;
  UPDATE ai_credits SET credits_used = credits_used + p_credits WHERE id = v_credit_row.id;
  INSERT INTO ai_credit_transactions
    (account_id, ai_credits_id, type, action, credits_delta, contato_id, metadata)
  VALUES (p_account_id, v_credit_row.id, 'consumed', p_action, -p_credits, p_lead_id, p_metadata);
  RETURN jsonb_build_object('success', true, 'credits_used', p_credits, 'remaining', v_available - p_credits);
END;
$function$;

-- ---------------------------------------------------------------------
-- 10. Parentesco entre contatos (mãe, pai, filho(a), irmão, avô, etc.)
-- ---------------------------------------------------------------------
CREATE TABLE public.contato_relationships (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contato_id         UUID NOT NULL REFERENCES public.contatos(id) ON DELETE CASCADE,
  related_contato_id UUID NOT NULL REFERENCES public.contatos(id) ON DELETE CASCADE,
  -- "related_contato_id é o {kind} de contato_id" (ex.: kind='mae' => related é mãe de contato)
  kind               TEXT NOT NULL CHECK (kind IN (
                       'mae','pai','filho','filha','irmao','irma','conjuge',
                       'avo','ava','neto','neta','tio','tia','primo','prima',
                       'responsavel','dependente','outro')),
  note               TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contato_relationships_no_self  CHECK (contato_id <> related_contato_id),
  CONSTRAINT contato_relationships_unique   UNIQUE (contato_id, related_contato_id, kind)
);

CREATE INDEX idx_contato_relationships_org     ON public.contato_relationships (organization_id);
CREATE INDEX idx_contato_relationships_contato ON public.contato_relationships (contato_id);
CREATE INDEX idx_contato_relationships_related ON public.contato_relationships (related_contato_id);

ALTER TABLE public.contato_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contato relationships access" ON public.contato_relationships
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()))
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Super admin access" ON public.contato_relationships
  FOR SELECT USING ((SELECT is_super_admin()));

CREATE POLICY "Super admin update" ON public.contato_relationships
  FOR UPDATE USING ((SELECT is_super_admin()));
