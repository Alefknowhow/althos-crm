-- ============================================================================
-- SECURITY FIX: stop trusting user_metadata for super-admin authorization.
--
-- Previously `is_super_admin()` read the flag from
--   auth.jwt() -> 'user_metadata' ->> 'is_super_admin'
-- but `user_metadata` (raw_user_meta_data) is writable by the user themselves
-- via supabase.auth.updateUser({ data: { is_super_admin: true } }). That allowed
-- ANY authenticated user to escalate to super-admin and bypass every org-scoped
-- RLS policy (can_access_org → is_super_admin).
--
-- This migration moves the trust boundary to `app_metadata`
-- (raw_app_meta_data), which is writable ONLY by the service-role key / Supabase
-- admin API and never by the end user.
-- ============================================================================

-- 1. Redefine the privilege check to read app_metadata only.
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::BOOLEAN,
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin',
    FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Recreate the organizations UPDATE policy without the inline
--    user_metadata reference (it had the same vulnerability).
DROP POLICY IF EXISTS "Organizations update" ON organizations;
CREATE POLICY "Organizations update" ON organizations
FOR UPDATE USING (can_access_org(id));

-- 3. Migrate any existing super-admins: copy the flag from user_metadata to
--    app_metadata, then strip it from user_metadata so it can never be abused.
--    (No-op on databases that never had a super-admin set this way.)
UPDATE auth.users
SET raw_app_meta_data =
      COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('is_super_admin', true)
WHERE (raw_user_meta_data ->> 'is_super_admin')::BOOLEAN = true;

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'is_super_admin'
WHERE raw_user_meta_data ? 'is_super_admin';
