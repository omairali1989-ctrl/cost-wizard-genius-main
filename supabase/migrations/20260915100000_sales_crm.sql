-- Sales operations: configurable process, workspace CRM, seller roster and acquisition economics.

CREATE TABLE IF NOT EXISTS public.sales_process_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  probability_pct numeric NOT NULL DEFAULT 0 CHECK (probability_pct BETWEEN 0 AND 100),
  color text NOT NULL DEFAULT 'slate',
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS sales_process_stages_order_idx
  ON public.sales_process_stages (company_id, sort_order);

CREATE TABLE IF NOT EXISTS public.sales_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  role text NOT NULL DEFAULT 'Sales representative',
  target_amount numeric NOT NULL DEFAULT 0 CHECK (target_amount >= 0),
  commission_rule_id uuid REFERENCES public.commission_rules(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_team_members_company_idx
  ON public.sales_team_members (company_id, active, name);

CREATE TABLE IF NOT EXISTS public.sales_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  company_name text,
  email text,
  phone text,
  source text NOT NULL DEFAULT 'Other',
  stage text NOT NULL DEFAULT 'New lead',
  owner_id uuid REFERENCES public.sales_team_members(id) ON DELETE SET NULL,
  estimated_value numeric NOT NULL DEFAULT 0 CHECK (estimated_value >= 0),
  notes text,
  next_action text,
  next_action_at timestamptz,
  last_contact_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_leads_pipeline_idx
  ON public.sales_leads (company_id, stage, owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.lead_acquisition_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  source text NOT NULL DEFAULT 'All channels',
  spend_amount numeric NOT NULL DEFAULT 0 CHECK (spend_amount >= 0),
  leads_generated integer NOT NULL DEFAULT 0 CHECK (leads_generated >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_acquisition_costs_period_idx
  ON public.lead_acquisition_costs (company_id, period_start DESC, source);

ALTER TABLE public.sales_process_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_acquisition_costs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_process_stages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_acquisition_costs TO authenticated;

CREATE POLICY sales_process_stages_select ON public.sales_process_stages
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY sales_process_stages_write ON public.sales_process_stages
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.can_edit())
  WITH CHECK (company_id = public.current_company_id() AND public.can_edit());

CREATE POLICY sales_team_members_select ON public.sales_team_members
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY sales_team_members_write ON public.sales_team_members
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.can_edit())
  WITH CHECK (company_id = public.current_company_id() AND public.can_edit());

CREATE POLICY sales_leads_select ON public.sales_leads
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY sales_leads_write ON public.sales_leads
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.can_edit())
  WITH CHECK (company_id = public.current_company_id() AND public.can_edit());

CREATE POLICY lead_acquisition_costs_select ON public.lead_acquisition_costs
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY lead_acquisition_costs_write ON public.lead_acquisition_costs
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.can_edit())
  WITH CHECK (company_id = public.current_company_id() AND public.can_edit());

CREATE TRIGGER sales_process_stages_updated_at BEFORE UPDATE ON public.sales_process_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER sales_team_members_updated_at BEFORE UPDATE ON public.sales_team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER sales_leads_updated_at BEFORE UPDATE ON public.sales_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER lead_acquisition_costs_updated_at BEFORE UPDATE ON public.lead_acquisition_costs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Give existing workspaces a usable process immediately. New workspaces can use
-- the same defaults from the app and persist/customize them from Sales settings.
INSERT INTO public.sales_process_stages
  (company_id, name, sort_order, probability_pct, color, is_won, is_lost)
SELECT c.id, defaults.name, defaults.sort_order, defaults.probability_pct,
       defaults.color, defaults.is_won, defaults.is_lost
FROM public.companies c
CROSS JOIN (VALUES
  ('New lead', 0, 10, 'slate', false, false),
  ('Qualified', 1, 25, 'blue', false, false),
  ('Proposal', 2, 50, 'amber', false, false),
  ('Negotiation', 3, 75, 'violet', false, false),
  ('Won', 4, 100, 'emerald', true, false),
  ('Lost', 5, 0, 'rose', false, true)
) AS defaults(name, sort_order, probability_pct, color, is_won, is_lost)
ON CONFLICT (company_id, name) DO NOTHING;
