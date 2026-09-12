
-- enums
CREATE TYPE public.app_role AS ENUM ('admin','manager','viewer');

-- companies
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  full_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id, role)
);

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  job_title text,
  department text,
  seniority text,
  annual_salary numeric NOT NULL DEFAULT 0,
  employer_cost_pct numeric NOT NULL DEFAULT 20,
  billable_target_pct numeric NOT NULL DEFAULT 75,
  skills text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.overheads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  monthly_amount numeric NOT NULL DEFAULT 0,
  allocation_basis text NOT NULL DEFAULT 'per_employee',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cost_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  working_days_per_year numeric NOT NULL DEFAULT 220,
  hours_per_day numeric NOT NULL DEFAULT 8,
  default_utilization_pct numeric NOT NULL DEFAULT 75,
  default_contingency_pct numeric NOT NULL DEFAULT 10,
  default_margin_pct numeric NOT NULL DEFAULT 25,
  pricing_mode text NOT NULL DEFAULT 'margin',
  default_markup_pct numeric NOT NULL DEFAULT 35,
  rounding_step numeric NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  client_name text,
  description text,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Version 1',
  version integer NOT NULL DEFAULT 1,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  results jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_snapshot boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.overheads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calculations TO authenticated;
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.companies, public.profiles, public.user_roles, public.employees,
  public.overheads, public.cost_policies, public.projects, public.calculations, public.audit_log TO service_role;

-- helper functions
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.can_edit()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin','manager')
  )
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- company bootstrap
CREATE OR REPLACE FUNCTION public.create_company(_name text, _industry text, _currency text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF (SELECT company_id FROM public.profiles WHERE id = auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'Already part of a company';
  END IF;
  INSERT INTO public.companies (name, industry, currency)
  VALUES (_name, _industry, COALESCE(_currency,'USD')) RETURNING id INTO new_id;
  INSERT INTO public.profiles (id, company_id) VALUES (auth.uid(), new_id)
    ON CONFLICT (id) DO UPDATE SET company_id = new_id;
  INSERT INTO public.user_roles (user_id, company_id, role) VALUES (auth.uid(), new_id, 'admin');
  INSERT INTO public.cost_policies (company_id) VALUES (new_id);
  INSERT INTO public.overheads (company_id, name, category, monthly_amount, allocation_basis) VALUES
    (new_id, 'Office & facilities', 'facilities', 0, 'per_employee'),
    (new_id, 'Software & tooling', 'software', 0, 'per_employee'),
    (new_id, 'Admin & support staff', 'admin', 0, 'per_employee');
  INSERT INTO public.audit_log (company_id, user_id, action, entity, entity_id)
    VALUES (new_id, auth.uid(), 'created', 'company', new_id);
  RETURN new_id;
END; $$;

-- triggers
CREATE TRIGGER t1 BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t2 BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t3 BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t4 BEFORE UPDATE ON public.overheads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t5 BEFORE UPDATE ON public.cost_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t6 BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t7 BEFORE UPDATE ON public.calculations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overheads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY companies_select ON public.companies FOR SELECT TO authenticated
  USING (id = public.current_company_id());
CREATE POLICY companies_update ON public.companies FOR UPDATE TO authenticated
  USING (id = public.current_company_id() AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (id = public.current_company_id());

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR (company_id IS NOT NULL AND company_id = public.current_company_id()));
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR company_id = public.current_company_id());
CREATE POLICY roles_admin_manage ON public.user_roles FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (company_id = public.current_company_id() AND public.has_role(auth.uid(),'admin'));

CREATE POLICY employees_select ON public.employees FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY employees_write ON public.employees FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.can_edit())
  WITH CHECK (company_id = public.current_company_id() AND public.can_edit());

CREATE POLICY overheads_select ON public.overheads FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY overheads_write ON public.overheads FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.can_edit())
  WITH CHECK (company_id = public.current_company_id() AND public.can_edit());

CREATE POLICY policies_select ON public.cost_policies FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY policies_write ON public.cost_policies FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.can_edit())
  WITH CHECK (company_id = public.current_company_id() AND public.can_edit());

CREATE POLICY projects_select ON public.projects FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY projects_write ON public.projects FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.can_edit())
  WITH CHECK (company_id = public.current_company_id() AND public.can_edit());

CREATE POLICY calculations_select ON public.calculations FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY calculations_write ON public.calculations FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.can_edit())
  WITH CHECK (company_id = public.current_company_id() AND public.can_edit());

CREATE POLICY audit_select ON public.audit_log FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY audit_insert ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND user_id = auth.uid());
