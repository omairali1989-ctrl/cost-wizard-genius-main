DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
	FOR UPDATE TO authenticated
	USING (id = auth.uid())
	WITH CHECK (
		id = auth.uid()
		AND company_id IS NOT DISTINCT FROM (
			SELECT company_id FROM public.profiles WHERE id = auth.uid()
		)
	);

CREATE OR REPLACE FUNCTION public.company_members()
RETURNS TABLE (user_id uuid, full_name text, email text, roles text[], joined_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
	IF NOT public.is_company_admin() THEN
		RAISE EXCEPTION 'Only administrators can view workspace members.';
	END IF;

	RETURN QUERY
	SELECT p.id, p.full_name, p.email,
		COALESCE(ARRAY(SELECT ur.role::text FROM public.user_roles ur
			WHERE ur.user_id = p.id AND ur.company_id = p.company_id ORDER BY ur.role::text), '{}'),
		p.created_at
	FROM public.profiles p
	WHERE p.company_id IS NOT NULL AND p.company_id = public.current_company_id()
	ORDER BY p.created_at;
END;
$$;

CREATE INDEX IF NOT EXISTS profiles_company_id_idx ON public.profiles (company_id);
CREATE INDEX IF NOT EXISTS user_roles_company_user_idx ON public.user_roles (company_id, user_id);
CREATE INDEX IF NOT EXISTS employees_company_id_idx ON public.employees (company_id);
CREATE INDEX IF NOT EXISTS overheads_company_id_idx ON public.overheads (company_id);
CREATE INDEX IF NOT EXISTS projects_company_created_idx ON public.projects (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS calculations_company_created_idx ON public.calculations (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS calculations_project_version_idx ON public.calculations (project_id, version DESC);
CREATE INDEX IF NOT EXISTS audit_log_company_created_idx ON public.audit_log (company_id, created_at DESC);
