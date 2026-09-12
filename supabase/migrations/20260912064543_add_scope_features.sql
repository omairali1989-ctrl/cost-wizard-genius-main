CREATE TABLE public.scope_features (
	id text PRIMARY KEY,
	company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
	category text NOT NULL,
	label text NOT NULL,
	description text NOT NULL DEFAULT '',
	effort jsonb NOT NULL DEFAULT '{}'::jsonb,
	icon text NOT NULL DEFAULT '⚡',
	tags text[] NOT NULL DEFAULT '{}',
	sort_order integer NOT NULL DEFAULT 0,
	is_custom boolean NOT NULL DEFAULT false,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX scope_features_company_sort_idx
	ON public.scope_features (company_id, sort_order);

ALTER TABLE public.scope_features ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scope_features TO authenticated;

CREATE POLICY scope_features_select ON public.scope_features
	FOR SELECT TO authenticated
	USING (company_id IS NULL OR company_id = public.current_company_id());

CREATE POLICY scope_features_insert ON public.scope_features
	FOR INSERT TO authenticated
	WITH CHECK (
		company_id = public.current_company_id()
		AND public.can_manage_costs()
	);

CREATE POLICY scope_features_update ON public.scope_features
	FOR UPDATE TO authenticated
	USING (company_id = public.current_company_id() AND public.can_manage_costs())
	WITH CHECK (company_id = public.current_company_id() AND public.can_manage_costs());

CREATE POLICY scope_features_delete ON public.scope_features
	FOR DELETE TO authenticated
	USING (company_id = public.current_company_id() AND public.can_manage_costs());

CREATE TRIGGER scope_features_updated_at
	BEFORE UPDATE ON public.scope_features
	FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
