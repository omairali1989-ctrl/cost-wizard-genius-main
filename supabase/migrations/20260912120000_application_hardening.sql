-- Application hardening: enforce domain ranges, serialize version allocation,
-- and expose only non-sensitive workspace policy settings to calculator users.

ALTER TABLE public.employees
  ADD CONSTRAINT employees_annual_salary_nonnegative CHECK (annual_salary >= 0) NOT VALID,
  ADD CONSTRAINT employees_monthly_salary_nonnegative CHECK (monthly_salary >= 0) NOT VALID,
  ADD CONSTRAINT employees_employer_cost_pct_range CHECK (employer_cost_pct BETWEEN 0 AND 200) NOT VALID,
  ADD CONSTRAINT employees_billable_target_pct_range CHECK (billable_target_pct BETWEEN 0 AND 100) NOT VALID;

ALTER TABLE public.overheads
  ADD CONSTRAINT overheads_amount_nonnegative CHECK (monthly_amount >= 0) NOT VALID,
  ADD CONSTRAINT overheads_allocation_basis_valid CHECK (allocation_basis IN ('per_employee', 'flat')) NOT VALID;

ALTER TABLE public.cost_policies
  ADD CONSTRAINT policies_working_days_range CHECK (working_days_per_year BETWEEN 1 AND 366) NOT VALID,
  ADD CONSTRAINT policies_hours_per_day_range CHECK (hours_per_day BETWEEN 1 AND 24) NOT VALID,
  ADD CONSTRAINT policies_utilization_range CHECK (default_utilization_pct BETWEEN 1 AND 100) NOT VALID,
  ADD CONSTRAINT policies_contingency_range CHECK (default_contingency_pct BETWEEN 0 AND 100) NOT VALID,
  ADD CONSTRAINT policies_margin_range CHECK (default_margin_pct BETWEEN 0 AND 95) NOT VALID,
  ADD CONSTRAINT policies_markup_range CHECK (default_markup_pct BETWEEN 0 AND 1000) NOT VALID,
  ADD CONSTRAINT policies_rounding_positive CHECK (rounding_step > 0) NOT VALID,
  ADD CONSTRAINT policies_pricing_mode_valid CHECK (pricing_mode IN ('margin', 'markup')) NOT VALID;

-- Existing databases may contain duplicate legacy version numbers. Renumber them
-- deterministically before enforcing uniqueness; no calculation rows are deleted.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at, id) AS next_version
  FROM public.calculations
  WHERE project_id IS NOT NULL
)
UPDATE public.calculations c
SET version = ranked.next_version
FROM ranked
WHERE c.id = ranked.id;

CREATE UNIQUE INDEX IF NOT EXISTS calculations_project_version_unique
  ON public.calculations (project_id, version)
  WHERE project_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.company_policy()
RETURNS TABLE (
  working_days_per_year numeric,
  hours_per_day numeric,
  default_utilization_pct numeric,
  default_contingency_pct numeric,
  default_margin_pct numeric,
  default_markup_pct numeric,
  pricing_mode text,
  rounding_step numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.working_days_per_year, p.hours_per_day, p.default_utilization_pct,
    p.default_contingency_pct, p.default_margin_pct, p.default_markup_pct,
    p.pricing_mode, p.rounding_step
  FROM public.cost_policies p
  WHERE auth.uid() IS NOT NULL AND p.company_id = public.current_company_id()
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.company_policy() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.company_policy() TO authenticated;

DROP POLICY IF EXISTS policies_select ON public.cost_policies;
CREATE POLICY policies_select ON public.cost_policies FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.can_view_finance());

CREATE OR REPLACE FUNCTION public.save_calculation(
  _project_id uuid,
  _project_name text,
  _client_name text,
  _description text,
  _label text,
  _inputs jsonb,
  _results jsonb
)
RETURNS public.calculations
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  cid uuid := public.current_company_id();
  pid uuid := _project_id;
  next_version integer;
  saved public.calculations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF cid IS NULL OR NOT public.can_edit() THEN
    RAISE EXCEPTION 'You are not allowed to save estimates';
  END IF;

  IF pid IS NULL THEN
    INSERT INTO public.projects (company_id, name, client_name, description, created_by)
    VALUES (cid, COALESCE(NULLIF(trim(_project_name), ''), 'New Estimate Project'), _client_name, _description, auth.uid())
    RETURNING id INTO pid;
  ELSE
    -- Lock the project row so version allocation is serialized per project.
    PERFORM 1 FROM public.projects WHERE id = pid AND company_id = cid FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Project not found or not accessible';
    END IF;
    UPDATE public.projects
    SET name = COALESCE(NULLIF(trim(_project_name), ''), 'Untitled Project'),
        client_name = _client_name,
        description = _description
    WHERE id = pid AND company_id = cid;
  END IF;

  SELECT COALESCE(MAX(c.version), 0) + 1 INTO next_version
  FROM public.calculations c
  WHERE c.project_id = pid;

  INSERT INTO public.calculations (company_id, project_id, label, version, inputs, results, created_by)
  VALUES (cid, pid, COALESCE(NULLIF(trim(_label), ''), 'Version ' || next_version), next_version,
          COALESCE(_inputs, '{}'::jsonb), COALESCE(_results, '{}'::jsonb), auth.uid())
  RETURNING * INTO saved;

  RETURN saved;
END;
$$;

REVOKE ALL ON FUNCTION public.save_calculation(uuid, text, text, text, text, jsonb, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_calculation(uuid, text, text, text, text, jsonb, jsonb) TO authenticated;
