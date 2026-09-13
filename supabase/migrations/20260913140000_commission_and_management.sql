-- Sales commission rules and management cost allocation.
--
-- Commission was a single hardcoded percentage paid to one named person. It becomes
-- a set of tenant rules with a resolution order, and executives gain the fields
-- needed to carry a real fully loaded cost and an allocation share.

-- ── Pay components beyond base salary ─────────────────────────────────────────
-- Fully loaded cost is salary plus everything else the company pays to employ
-- someone; without these an executive's cost is understated.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS monthly_allowances numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_benefits numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_other_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_bonus numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS employment_type text NOT NULL DEFAULT 'full_time',
  ADD COLUMN IF NOT EXISTS employee_code text,
  -- Share of this person's time that reaches project work at all (0 = pure overhead).
  ADD COLUMN IF NOT EXISTS management_allocation_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allocation_basis text NOT NULL DEFAULT 'equal',
  ADD COLUMN IF NOT EXISTS allocation_custom_amount numeric,
  -- Sales-specific
  ADD COLUMN IF NOT EXISTS sales_target numeric,
  ADD COLUMN IF NOT EXISTS commission_rule_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_allocation_pct_check') THEN
    ALTER TABLE public.employees ADD CONSTRAINT employees_allocation_pct_check
      CHECK (management_allocation_pct >= 0 AND management_allocation_pct <= 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_allocation_basis_check') THEN
    ALTER TABLE public.employees ADD CONSTRAINT employees_allocation_basis_check
      CHECK (allocation_basis IN (
        'project_revenue','project_cost','project_duration','resource_hours',
        'equal','percentage','custom'
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_employment_type_check') THEN
    ALTER TABLE public.employees ADD CONSTRAINT employees_employment_type_check
      CHECK (employment_type IN ('full_time','part_time','contractor','intern','advisor'));
  END IF;
END $$;

-- ── Commission rules ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  model text NOT NULL DEFAULT 'percentage_of_sales_value',
  scope text NOT NULL DEFAULT 'tenant',
  -- Employee id, role, department, project id or sales category; NULL for tenant scope.
  scope_value text,
  rate_pct numeric,
  fixed_amount numeric,
  -- [{fromAmount, toAmount, ratePct}] ordered bands; toAmount null means "and above".
  tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  tier_mode text NOT NULL DEFAULT 'marginal',
  target_amount numeric,
  below_target_rate_pct numeric,
  above_target_rate_pct numeric,
  basis text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commission_rules_model_check CHECK (model IN (
    'percentage_of_sales_value','percentage_of_collected_revenue','percentage_of_gross_profit',
    'fixed_per_project','tiered','target_based','hybrid'
  )),
  CONSTRAINT commission_rules_scope_check CHECK (scope IN (
    'tenant','sales_category','department','role','employee','project'
  )),
  CONSTRAINT commission_rules_basis_check CHECK (
    basis IS NULL OR basis IN ('sales_value','collected_revenue','gross_profit')
  ),
  CONSTRAINT commission_rules_tier_mode_check CHECK (tier_mode IN ('marginal','flat'))
);

CREATE INDEX IF NOT EXISTS commission_rules_lookup_idx
  ON public.commission_rules (company_id, scope, scope_value)
  WHERE active;

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_rules TO authenticated;

CREATE POLICY commission_rules_select ON public.commission_rules
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY commission_rules_write ON public.commission_rules
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.can_manage_costs())
  WITH CHECK (company_id = public.current_company_id() AND public.can_manage_costs());

CREATE TRIGGER commission_rules_updated_at
  BEFORE UPDATE ON public.commission_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Salary history ────────────────────────────────────────────────────────────
-- Saved estimates keep the cost that applied when they were made, so changing a
-- salary must not rewrite the margin on a quote that has already gone out.
CREATE TABLE IF NOT EXISTS public.employee_salary_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  monthly_salary numeric NOT NULL DEFAULT 0,
  monthly_allowances numeric NOT NULL DEFAULT 0,
  monthly_benefits numeric NOT NULL DEFAULT 0,
  monthly_other_cost numeric NOT NULL DEFAULT 0,
  employer_cost_pct numeric NOT NULL DEFAULT 0,
  salary_currency text NOT NULL DEFAULT 'USD',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, effective_from)
);

CREATE INDEX IF NOT EXISTS salary_history_lookup_idx
  ON public.employee_salary_history (employee_id, effective_from DESC);

ALTER TABLE public.employee_salary_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_salary_history TO authenticated;

-- Salary history is finance data; it follows the same visibility as salaries.
CREATE POLICY salary_history_select ON public.employee_salary_history
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.can_manage_costs());

CREATE POLICY salary_history_write ON public.employee_salary_history
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.can_manage_costs())
  WITH CHECK (company_id = public.current_company_id() AND public.can_manage_costs());
