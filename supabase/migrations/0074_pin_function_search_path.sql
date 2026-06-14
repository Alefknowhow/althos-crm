-- Security: pin a non-mutable search_path on every public function that lacked
-- one (advisor: function_search_path_mutable ×18). Prevents search_path-hijack
-- of SECURITY DEFINER functions. 'public, extensions' preserves current name
-- resolution (public tables + extension helpers); auth.* calls are already
-- schema-qualified in the bodies, so behavior is unchanged.

ALTER FUNCTION public.auto_promote_to_customer()                                   SET search_path = public, extensions;
ALTER FUNCTION public.can_access_org(uuid)                                         SET search_path = public, extensions;
ALTER FUNCTION public.cleanup_public_request_log()                                 SET search_path = public, extensions;
ALTER FUNCTION public.dashboard_funnel(uuid, uuid)                                 SET search_path = public, extensions;
ALTER FUNCTION public.dashboard_funnel(uuid)                                       SET search_path = public, extensions;
ALTER FUNCTION public.dashboard_lead_sources(uuid, timestamptz)                    SET search_path = public, extensions;
ALTER FUNCTION public.dashboard_lead_sources(uuid, timestamptz, uuid)             SET search_path = public, extensions;
ALTER FUNCTION public.dashboard_leads_timeseries(uuid, timestamptz, uuid)         SET search_path = public, extensions;
ALTER FUNCTION public.dashboard_leads_timeseries(uuid, timestamptz)               SET search_path = public, extensions;
ALTER FUNCTION public.dashboard_revenue(uuid, uuid, timestamptz)                  SET search_path = public, extensions;
ALTER FUNCTION public.dashboard_revenue(uuid, uuid, timestamptz, uuid)            SET search_path = public, extensions;
ALTER FUNCTION public.generate_account_referral_code()                             SET search_path = public, extensions;
ALTER FUNCTION public.get_plan_limits(text)                                        SET search_path = public, extensions;
ALTER FUNCTION public.is_super_admin()                                             SET search_path = public, extensions;
ALTER FUNCTION public.set_travel_showcase_updated_at()                             SET search_path = public, extensions;
ALTER FUNCTION public.trg_update_contato_last_activity()                           SET search_path = public, extensions;
ALTER FUNCTION public.update_updated_at()                                          SET search_path = public, extensions;
ALTER FUNCTION public.update_updated_at_column()                                   SET search_path = public, extensions;
