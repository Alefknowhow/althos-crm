-- Approval is a user-session action, never an MCP tool argument.
CREATE TABLE public.agent_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_id uuid NOT NULL REFERENCES public.agent_tokens(id) ON DELETE CASCADE,
  tool text NOT NULL,
  input jsonb NOT NULL,
  preview jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','executing','succeeded','failed','rejected')),
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  completed_at timestamptz
);
CREATE INDEX agent_approval_requests_owner ON public.agent_approval_requests (organization_id, user_id, created_at DESC);
CREATE INDEX agent_approval_requests_token ON public.agent_approval_requests (token_id);
ALTER TABLE public.agent_approval_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_approval_requests FROM anon, authenticated;
GRANT SELECT ON public.agent_approval_requests TO authenticated;
GRANT ALL ON public.agent_approval_requests TO service_role;
CREATE POLICY "Request owner can read own organization approvals" ON public.agent_approval_requests
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND organization_id IN (SELECT public.get_user_organizations()));
-- No INSERT/UPDATE/DELETE policies: only the authenticated server action
-- may consume approvals; a client cannot approve by updating this table.
