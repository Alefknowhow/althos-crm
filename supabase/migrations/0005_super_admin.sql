-- Create super_admin_audit_log table
CREATE TABLE IF NOT EXISTS super_admin_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    super_admin_user_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL CHECK (action IN ('impersonate_start', 'impersonate_end')),
    target_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ip TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on audit log
ALTER TABLE super_admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only super admins can see audit logs (will define the check function below)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() -> 'user_metadata' ->> 'is_super_admin')::BOOLEAN = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Super admins can access audit logs"
ON super_admin_audit_log
FOR ALL
USING (is_super_admin());

-- Update RLS policies for all tables to support impersonation
-- We need to check if the user is a super admin AND has the impersonation cookie/session.
-- However, since the cookie is handled on the server side (Next.js), we can use a custom setting
-- or just rely on the super admin flag if we trust the server action to validate the session.
-- A better way is to pass the impersonated_org_id via a search path or a session variable in Postgres.
-- But Supabase RLS works best with JWT claims.

-- Let's define a policy helper that checks for impersonation.
-- In Supabase, we can't easily read cookies in RLS unless we set them as session variables.
-- For now, we will allow super admins to see EVERYTHING if they are marked as such.
-- The "Visual clear" part (banner) will handle the UX.

-- Redefining policies for multi-tenancy to include super admin access
-- We'll use a function to check if the user is allowed to access the organization.

CREATE OR REPLACE FUNCTION can_access_org(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- 1. Check if user is a member
  IF EXISTS (SELECT 1 FROM memberships WHERE user_id = auth.uid() AND organization_id = org_id) THEN
    RETURN TRUE;
  END IF;

  -- 2. Check if user is a super admin
  IF is_super_admin() THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing policies (this is a bit manual but necessary)
-- Note: We need to be careful with the "No DELETE" restriction for super admins.

DROP POLICY IF EXISTS "Organizations access" ON organizations;
CREATE POLICY "Organizations access" ON organizations
FOR SELECT USING (can_access_org(id));
CREATE POLICY "Organizations update" ON organizations
FOR UPDATE USING (can_access_org(id) AND (NOT is_super_admin() OR (auth.jwt() -> 'user_metadata' ->> 'is_super_admin')::BOOLEAN = true)); -- Admins can update, but we'll restrict sensitive fields in the code

-- For other tables, we'll follow a similar pattern but RESTRICT DELETE for super admins.

DROP POLICY IF EXISTS "Super admin memberships access" ON memberships;
CREATE POLICY "Super admin memberships access" ON memberships FOR SELECT USING (is_super_admin());

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name NOT IN ('organizations', 'memberships', 'super_admin_audit_log')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Super admin access" ON %I', t);
        EXECUTE format('CREATE POLICY "Super admin access" ON %I FOR SELECT USING (is_super_admin())', t);
        EXECUTE format('CREATE POLICY "Super admin update" ON %I FOR UPDATE USING (is_super_admin())', t);
        -- Note: No DELETE policy for super admins here
    END LOOP;
END $$;
