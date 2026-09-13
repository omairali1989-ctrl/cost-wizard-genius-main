-- Avoid overlapping FOR ALL policies. Separate policies make the intended
-- operation boundary explicit and avoid applying write predicates to reads.

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;

DROP POLICY IF EXISTS roles_admin_manage ON public.user_roles;
CREATE POLICY roles_admin_insert ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY roles_admin_update ON public.user_roles FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY roles_admin_delete ON public.user_roles FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin());

DROP POLICY IF EXISTS employees_write ON public.employees;
CREATE POLICY employees_insert ON public.employees FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.can_manage_costs());
CREATE POLICY employees_update ON public.employees FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.can_manage_costs())
  WITH CHECK (company_id = public.current_company_id() AND public.can_manage_costs());
CREATE POLICY employees_delete ON public.employees FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.can_manage_costs());

DROP POLICY IF EXISTS overheads_write ON public.overheads;
CREATE POLICY overheads_insert ON public.overheads FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.can_manage_costs());
CREATE POLICY overheads_update ON public.overheads FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.can_manage_costs())
  WITH CHECK (company_id = public.current_company_id() AND public.can_manage_costs());
CREATE POLICY overheads_delete ON public.overheads FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.can_manage_costs());

DROP POLICY IF EXISTS policies_write ON public.cost_policies;
CREATE POLICY policies_insert ON public.cost_policies FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.can_manage_costs());
CREATE POLICY policies_update ON public.cost_policies FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.can_manage_costs())
  WITH CHECK (company_id = public.current_company_id() AND public.can_manage_costs());
CREATE POLICY policies_delete ON public.cost_policies FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.can_manage_costs());

DROP POLICY IF EXISTS projects_write ON public.projects;
CREATE POLICY projects_insert ON public.projects FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.can_edit());
CREATE POLICY projects_update ON public.projects FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.can_edit())
  WITH CHECK (company_id = public.current_company_id() AND public.can_edit());
CREATE POLICY projects_delete ON public.projects FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.can_edit());

DROP POLICY IF EXISTS calculations_write ON public.calculations;
CREATE POLICY calculations_insert ON public.calculations FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.can_edit());
CREATE POLICY calculations_update ON public.calculations FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.can_edit())
  WITH CHECK (company_id = public.current_company_id() AND public.can_edit());
CREATE POLICY calculations_delete ON public.calculations FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.can_edit());

DROP POLICY IF EXISTS project_presets_write ON public.project_presets;
CREATE POLICY project_presets_insert ON public.project_presets FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.can_manage_costs());
CREATE POLICY project_presets_update ON public.project_presets FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.can_manage_costs())
  WITH CHECK (company_id = public.current_company_id() AND public.can_manage_costs());
CREATE POLICY project_presets_delete ON public.project_presets FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.can_manage_costs());

DROP POLICY IF EXISTS invitations_admin_all ON public.invitations;
CREATE POLICY invitations_admin_select ON public.invitations FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY invitations_admin_insert ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY invitations_admin_update ON public.invitations FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY invitations_admin_delete ON public.invitations FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin());
