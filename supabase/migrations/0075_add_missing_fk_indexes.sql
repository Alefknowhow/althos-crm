-- Performance: add btree indexes covering foreign keys that had none
-- (advisor: unindexed_foreign_keys ×37). Purely additive — speeds up joins
-- and cascade/ON DELETE checks, and avoids seq-scans on these FKs as data grows.
-- Tables are tiny today so creation is instant; IF NOT EXISTS keeps it idempotent.

CREATE INDEX IF NOT EXISTS idx_account_members_user_id              ON public.account_members(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_owner_user_id               ON public.accounts(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_credit_transactions_ai_credits_id ON public.ai_credit_transactions(ai_credits_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_messages_organization_id ON public.ai_insights_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_sandbox_messages_organization_id  ON public.ai_sandbox_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_contato_id           ON public.automation_runs(contato_id);
CREATE INDEX IF NOT EXISTS idx_automation_step_logs_organization_id ON public.automation_step_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_availabilities_organization_id       ON public.availabilities(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_organization_id       ON public.billing_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_contato_documents_organization_id    ON public.contato_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_contatos_pipeline_id                 ON public.contatos(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_contatos_stage_id                    ON public.contatos(stage_id);
CREATE INDEX IF NOT EXISTS idx_coupon_uses_account_id               ON public.coupon_uses(account_id);
CREATE INDEX IF NOT EXISTS idx_coupons_applies_to_plan              ON public.coupons(applies_to_plan);
CREATE INDEX IF NOT EXISTS idx_email_sends_contato_id               ON public.email_sends(contato_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_template_id              ON public.email_sends(template_id);
CREATE INDEX IF NOT EXISTS idx_event_types_pipeline_id              ON public.event_types(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_event_types_stage_id                 ON public.event_types(stage_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_contato_id          ON public.form_submissions(contato_id);
CREATE INDEX IF NOT EXISTS idx_forms_pipeline_id                    ON public.forms(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_forms_stage_id                       ON public.forms(stage_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id                ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_invites_created_by      ON public.organization_invites(created_by);
CREATE INDEX IF NOT EXISTS idx_organization_invites_used_by_org     ON public.organization_invites(used_by_org);
CREATE INDEX IF NOT EXISTS idx_organizations_account_id             ON public.organizations(account_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_organization_id   ON public.push_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_account_id        ON public.referrals(referred_account_id);
CREATE INDEX IF NOT EXISTS idx_sales_product_id                     ON public.sales(product_id);
CREATE INDEX IF NOT EXISTS idx_social_interactions_automation_id    ON public.social_interactions(social_automation_id);
CREATE INDEX IF NOT EXISTS idx_social_interactions_connection_id    ON public.social_interactions(social_connection_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id                ON public.subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_audit_log_admin_user_id  ON public.super_admin_audit_log(super_admin_user_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_audit_log_target_org_id  ON public.super_admin_audit_log(target_organization_id);
CREATE INDEX IF NOT EXISTS idx_system_alerts_target_account_id      ON public.system_alerts(target_account_id);
CREATE INDEX IF NOT EXISTS idx_tasks_contato_id                     ON public.tasks(contato_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_contato_id    ON public.whatsapp_conversations(contato_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation_id    ON public.whatsapp_messages(conversation_id);
