-- Estimation foundation: the relational chain the engine needs.
--
--   Blueprint → Module → Feature → Task → Skill/Role → effort
--
-- Features already carry role-level effort per complexity; tasks add the finer
-- granularity that AI productivity factors need, because a factor depends on the
-- KIND of activity (boilerplate vs architecture), not just the role performing it.
-- Features with no tasks keep using their existing effort JSON, so nothing breaks.

-- ── Modules ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blueprint_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  -- Which blueprint this module belongs to; matches project_presets.id (text).
  blueprint_id text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blueprint_modules_lookup_idx
  ON public.blueprint_modules (company_id, blueprint_id, sort_order)
  WHERE archived_at IS NULL;

-- ── Tasks ─────────────────────────────────────────────────────────────────────
-- activity_kind drives the AI productivity factor; role_key drives which rate applies.
CREATE TABLE IF NOT EXISTS public.feature_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  feature_id text NOT NULL,
  name text NOT NULL,
  activity_kind text NOT NULL DEFAULT 'code_generation',
  role_key text NOT NULL DEFAULT 'backend',
  -- Base hours before any AI adjustment, per complexity tier.
  hours_low numeric NOT NULL DEFAULT 0,
  hours_medium numeric NOT NULL DEFAULT 0,
  hours_high numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feature_tasks_hours_non_negative
    CHECK (hours_low >= 0 AND hours_medium >= 0 AND hours_high >= 0)
);

CREATE INDEX IF NOT EXISTS feature_tasks_feature_idx
  ON public.feature_tasks (company_id, feature_id, sort_order)
  WHERE archived_at IS NULL;

-- ── AI productivity factors ───────────────────────────────────────────────────
-- One row per activity a tenant wants to deviate from the built-in default on.
-- reduction_pct is the share of effort AI removes: 0 = no help, 60 = 60% less work.
CREATE TABLE IF NOT EXISTS public.ai_productivity_factors (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  activity_kind text NOT NULL,
  reduction_pct numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, activity_kind),
  CONSTRAINT ai_factor_range CHECK (reduction_pct >= 0 AND reduction_pct <= 90)
);

-- ── Scope classification on features ──────────────────────────────────────────
-- Included / Optional / Excluded / To Be Confirmed / Client / Third-party dependency.
ALTER TABLE public.scope_features
  ADD COLUMN IF NOT EXISTS module_id uuid REFERENCES public.blueprint_modules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_inclusion text NOT NULL DEFAULT 'included';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scope_features_inclusion_check'
  ) THEN
    ALTER TABLE public.scope_features
      ADD CONSTRAINT scope_features_inclusion_check
      CHECK (default_inclusion IN (
        'included', 'optional', 'excluded', 'tbc', 'client_dependency', 'third_party_dependency'
      ));
  END IF;
END $$;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.blueprint_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_productivity_factors ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.blueprint_modules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_productivity_factors TO authenticated;

-- Built-in rows (company_id IS NULL) are readable by everyone, writable by no one.
CREATE POLICY blueprint_modules_select ON public.blueprint_modules
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.current_company_id());

CREATE POLICY blueprint_modules_write ON public.blueprint_modules
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.can_manage_costs())
  WITH CHECK (company_id = public.current_company_id() AND public.can_manage_costs());

CREATE POLICY feature_tasks_select ON public.feature_tasks
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.current_company_id());

CREATE POLICY feature_tasks_write ON public.feature_tasks
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.can_manage_costs())
  WITH CHECK (company_id = public.current_company_id() AND public.can_manage_costs());

CREATE POLICY ai_factors_select ON public.ai_productivity_factors
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY ai_factors_write ON public.ai_productivity_factors
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.can_manage_costs())
  WITH CHECK (company_id = public.current_company_id() AND public.can_manage_costs());

CREATE TRIGGER blueprint_modules_updated_at
  BEFORE UPDATE ON public.blueprint_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER feature_tasks_updated_at
  BEFORE UPDATE ON public.feature_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
