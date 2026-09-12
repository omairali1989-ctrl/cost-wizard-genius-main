-- 1. New role values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'management';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'project_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'technical_lead';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'calculator_user';

-- 2. Role helpers (text comparison so new enum labels work in this same transaction)
CREATE OR REPLACE FUNCTION public.has_any_role(_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.company_id = public.current_company_id()
      AND ur.role::text = ANY(_roles)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(ARRAY['admin'])
$$;

CREATE OR REPLACE FUNCTION public.can_manage_costs()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(ARRAY['admin','finance'])
$$;

CREATE OR REPLACE FUNCTION public.can_view_finance()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(ARRAY['admin','finance','management'])
$$;

CREATE OR REPLACE FUNCTION public.can_edit()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(ARRAY['admin','manager','management','project_manager','technical_lead','calculator_user'])
$$;

REVOKE ALL ON FUNCTION public.has_any_role(text[]) FROM public, anon;
REVOKE ALL ON FUNCTION public.is_company_admin() FROM public, anon;
REVOKE ALL ON FUNCTION public.can_manage_costs() FROM public, anon;
REVOKE ALL ON FUNCTION public.can_view_finance() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_any_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_costs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_finance() TO authenticated;

-- 3. Tighten financial data policies
DROP POLICY IF EXISTS employees_select ON public.employees;
DROP POLICY IF EXISTS employees_write ON public.employees;
CREATE POLICY employees_select ON public.employees FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.can_view_finance());
CREATE POLICY employees_write ON public.employees FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.can_manage_costs())
  WITH CHECK (company_id = public.current_company_id() AND public.can_manage_costs());

DROP POLICY IF EXISTS overheads_select ON public.overheads;
DROP POLICY IF EXISTS overheads_write ON public.overheads;
CREATE POLICY overheads_select ON public.overheads FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.can_view_finance());
CREATE POLICY overheads_write ON public.overheads FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.can_manage_costs())
  WITH CHECK (company_id = public.current_company_id() AND public.can_manage_costs());

DROP POLICY IF EXISTS policies_write ON public.cost_policies;
CREATE POLICY policies_write ON public.cost_policies FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.can_manage_costs())
  WITH CHECK (company_id = public.current_company_id() AND public.can_manage_costs());

-- 4. Salary-free rate list everyone in the workspace may read
CREATE OR REPLACE FUNCTION public.company_employee_rates()
RETURNS TABLE (
  id uuid, name text, job_title text, department text,
  seniority text, skills text[], active boolean, hourly_cost numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (SELECT public.current_company_id() AS cid),
  p AS (SELECT * FROM public.cost_policies WHERE company_id = (SELECT cid FROM c) LIMIT 1),
  n AS (SELECT GREATEST(COUNT(*), 1)::numeric AS cnt FROM public.employees
        WHERE company_id = (SELECT cid FROM c) AND active),
  oh AS (SELECT COALESCE(SUM(monthly_amount), 0) * 12 AS annual FROM public.overheads
         WHERE company_id = (SELECT cid FROM c))
  SELECT e.id, e.name, e.job_title, e.department, e.seniority, e.skills, e.active,
    CASE WHEN (p.working_days_per_year * p.hours_per_day *
        (COALESCE(NULLIF(e.billable_target_pct, 0), p.default_utilization_pct) / 100.0)) > 0
      THEN round((e.annual_salary * (1 + e.employer_cost_pct / 100.0) + (oh.annual / n.cnt))
        / (p.working_days_per_year * p.hours_per_day *
          (COALESCE(NULLIF(e.billable_target_pct, 0), p.default_utilization_pct) / 100.0)), 2)
      ELSE 0 END
  FROM public.employees e, p, n, oh
  WHERE e.company_id = (SELECT cid FROM c)
  ORDER BY e.name
$$;
REVOKE ALL ON FUNCTION public.company_employee_rates() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.company_employee_rates() TO authenticated;

-- 5. Invitations
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY invitations_admin_all ON public.invitations FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE UNIQUE INDEX invitations_one_pending_per_email
  ON public.invitations (company_id, lower(email)) WHERE status = 'pending';
CREATE TRIGGER t_invitations_updated BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Never lose the last admin
CREATE OR REPLACE FUNCTION public.protect_last_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.role::text = 'admin')
     OR (TG_OP = 'UPDATE' AND OLD.role::text = 'admin' AND NEW.role::text <> 'admin') THEN
    IF (SELECT COUNT(*) FROM public.user_roles
        WHERE company_id = OLD.company_id AND role::text = 'admin') <= 1 THEN
      RAISE EXCEPTION 'This workspace must keep at least one administrator.';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER t_protect_last_admin BEFORE UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_last_admin();

-- 7. Invitation lifecycle RPCs
CREATE OR REPLACE FUNCTION public.invitation_preview(_token uuid)
RETURNS TABLE (email text, role public.app_role, company_name text, status text, expired boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.email, i.role, c.name, i.status, (i.expires_at < now())
  FROM public.invitations i JOIN public.companies c ON c.id = i.company_id
  WHERE i.token = _token
$$;
REVOKE ALL ON FUNCTION public.invitation_preview(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.invitation_preview(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.accept_invitation(_token uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.invitations; uid uuid; uemail text;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN RAISE EXCEPTION 'Please sign in first.'; END IF;
  SELECT * INTO inv FROM public.invitations WHERE token = _token FOR UPDATE;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'This invitation link is not valid.'; END IF;
  IF inv.status <> 'pending' THEN RAISE EXCEPTION 'This invitation has already been used.'; END IF;
  IF inv.expires_at < now() THEN
    UPDATE public.invitations SET status = 'expired' WHERE id = inv.id;
    RAISE EXCEPTION 'This invitation has expired.';
  END IF;
  SELECT email INTO uemail FROM auth.users WHERE id = uid;
  IF lower(COALESCE(uemail, '')) <> lower(inv.email) THEN
    RAISE EXCEPTION 'This invitation was sent to %. Sign in with that email address.', inv.email;
  END IF;
  IF (SELECT company_id FROM public.profiles WHERE id = uid) IS NOT NULL THEN
    RAISE EXCEPTION 'You already belong to a workspace.';
  END IF;

  INSERT INTO public.profiles (id, email, company_id) VALUES (uid, uemail, inv.company_id)
    ON CONFLICT (id) DO UPDATE SET company_id = inv.company_id;
  INSERT INTO public.user_roles (user_id, company_id, role)
    VALUES (uid, inv.company_id, inv.role) ON CONFLICT (user_id, role) DO NOTHING;
  UPDATE public.invitations SET status = 'accepted', responded_at = now() WHERE id = inv.id;
  INSERT INTO public.audit_log (company_id, user_id, action, entity, entity_id, details)
    VALUES (inv.company_id, uid, 'accepted', 'invitation', inv.id,
      jsonb_build_object('email', inv.email, 'role', inv.role));
  RETURN inv.company_id;
END; $$;
REVOKE ALL ON FUNCTION public.accept_invitation(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_invitation(_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.invitations; uemail text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in first.'; END IF;
  SELECT * INTO inv FROM public.invitations WHERE token = _token FOR UPDATE;
  IF inv.id IS NULL OR inv.status <> 'pending' THEN RAISE EXCEPTION 'This invitation is no longer active.'; END IF;
  SELECT email INTO uemail FROM auth.users WHERE id = auth.uid();
  IF lower(COALESCE(uemail, '')) <> lower(inv.email) THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address.';
  END IF;
  UPDATE public.invitations SET status = 'declined', responded_at = now() WHERE id = inv.id;
  INSERT INTO public.audit_log (company_id, user_id, action, entity, entity_id, details)
    VALUES (inv.company_id, auth.uid(), 'declined', 'invitation', inv.id,
      jsonb_build_object('email', inv.email));
END; $$;
REVOKE ALL ON FUNCTION public.decline_invitation(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.decline_invitation(uuid) TO authenticated;

-- 8. Member management RPCs (admin only)
CREATE OR REPLACE FUNCTION public.company_members()
RETURNS TABLE (user_id uuid, full_name text, email text, roles text[], joined_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.email,
    COALESCE(ARRAY(SELECT ur.role::text FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.company_id = p.company_id ORDER BY ur.role::text), '{}'),
    p.created_at
  FROM public.profiles p
  WHERE p.company_id IS NOT NULL AND p.company_id = public.current_company_id()
  ORDER BY p.created_at
$$;
REVOKE ALL ON FUNCTION public.company_members() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.company_members() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_member_role(_user_id uuid, _role public.app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; existing_admins int;
BEGIN
  cid := public.current_company_id();
  IF cid IS NULL OR NOT public.is_company_admin() THEN RAISE EXCEPTION 'Only administrators can change roles.'; END IF;
  IF (SELECT company_id FROM public.profiles WHERE id = _user_id) IS DISTINCT FROM cid THEN
    RAISE EXCEPTION 'That person is not part of this workspace.';
  END IF;
  IF _role::text <> 'admin'
     AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND company_id = cid AND role::text = 'admin') THEN
    SELECT COUNT(*) INTO existing_admins FROM public.user_roles WHERE company_id = cid AND role::text = 'admin';
    IF existing_admins <= 1 THEN RAISE EXCEPTION 'This workspace must keep at least one administrator.'; END IF;
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND company_id = cid AND role <> _role;
  INSERT INTO public.user_roles (user_id, company_id, role) VALUES (_user_id, cid, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.audit_log (company_id, user_id, action, entity, entity_id, details)
    VALUES (cid, auth.uid(), 'changed_role', 'member', _user_id, jsonb_build_object('role', _role));
END; $$;
REVOKE ALL ON FUNCTION public.set_member_role(uuid, public.app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_member(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; admin_count int;
BEGIN
  cid := public.current_company_id();
  IF cid IS NULL OR NOT public.is_company_admin() THEN RAISE EXCEPTION 'Only administrators can remove members.'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot remove yourself.'; END IF;
  IF (SELECT company_id FROM public.profiles WHERE id = _user_id) IS DISTINCT FROM cid THEN
    RAISE EXCEPTION 'That person is not part of this workspace.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND company_id = cid AND role::text = 'admin') THEN
    SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE company_id = cid AND role::text = 'admin';
    IF admin_count <= 1 THEN RAISE EXCEPTION 'This workspace must keep at least one administrator.'; END IF;
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND company_id = cid;
  UPDATE public.profiles SET company_id = NULL WHERE id = _user_id;
  INSERT INTO public.audit_log (company_id, user_id, action, entity, entity_id, details)
    VALUES (cid, auth.uid(), 'removed', 'member', _user_id, '{}'::jsonb);
END; $$;
REVOKE ALL ON FUNCTION public.remove_member(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.remove_member(uuid) TO authenticated;