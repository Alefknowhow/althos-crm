-- Migration: 0023_automations_repair.sql
-- Description: Reconciles conflicting prior automation migrations (0001 used
-- `organization_id`; 0004 introduced a parallel `org_id` schema with RLS
-- pointing at a non-existent `organization_members` table). This migration
-- normalizes both `automations` and `automation_runs` to use `organization_id`
-- and the project's standard RLS via `get_user_organizations()`.
-- Safe to run multiple times.

-- ---- automations ----------------------------------------------------------
-- If `org_id` exists, copy data into `organization_id`, then drop it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automations' AND column_name = 'org_id'
  ) THEN
    -- Ensure organization_id column exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'automations' AND column_name = 'organization_id'
    ) THEN
      ALTER TABLE public.automations ADD COLUMN organization_id UUID;
    END IF;

    UPDATE public.automations SET organization_id = org_id WHERE organization_id IS NULL;
    ALTER TABLE public.automations DROP COLUMN org_id;
  END IF;
END $$;

-- Make organization_id NOT NULL + FK if not already
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automations' AND column_name = 'organization_id'
  ) THEN
    BEGIN
      ALTER TABLE public.automations ALTER COLUMN organization_id SET NOT NULL;
    EXCEPTION WHEN others THEN NULL;
    END;
    BEGIN
      ALTER TABLE public.automations
        ADD CONSTRAINT automations_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Drop the broken policies from 0004 (they reference organization_members)
DROP POLICY IF EXISTS "Users can view org automations" ON public.automations;
DROP POLICY IF EXISTS "Users can insert org automations" ON public.automations;
DROP POLICY IF EXISTS "Users can update org automations" ON public.automations;
DROP POLICY IF EXISTS "Users can delete org automations" ON public.automations;
DROP POLICY IF EXISTS "Automations access" ON public.automations;

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Automations access" ON public.automations
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

-- ---- automation_runs -------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_runs' AND column_name = 'org_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'automation_runs' AND column_name = 'organization_id'
    ) THEN
      ALTER TABLE public.automation_runs ADD COLUMN organization_id UUID;
    END IF;

    UPDATE public.automation_runs SET organization_id = org_id WHERE organization_id IS NULL;
    ALTER TABLE public.automation_runs DROP COLUMN org_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_runs' AND column_name = 'organization_id'
  ) THEN
    BEGIN
      ALTER TABLE public.automation_runs ALTER COLUMN organization_id SET NOT NULL;
    EXCEPTION WHEN others THEN NULL;
    END;
    BEGIN
      ALTER TABLE public.automation_runs
        ADD CONSTRAINT automation_runs_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view org automation runs" ON public.automation_runs;
DROP POLICY IF EXISTS "Users can insert org automation runs" ON public.automation_runs;
DROP POLICY IF EXISTS "Users can update org automation runs" ON public.automation_runs;
DROP POLICY IF EXISTS "Users can delete org automation runs" ON public.automation_runs;
DROP POLICY IF EXISTS "Automation runs access" ON public.automation_runs;

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Automation runs access" ON public.automation_runs
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

-- updated_at trigger for automations (was missing)
DROP TRIGGER IF EXISTS update_automations_updated_at ON public.automations;
CREATE TRIGGER update_automations_updated_at
BEFORE UPDATE ON public.automations
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();
