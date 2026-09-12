CREATE TABLE public.project_presets (
	id text NOT NULL,
	company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
	config jsonb NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (company_id, id)
);

CREATE INDEX project_presets_company_updated_idx
	ON public.project_presets (company_id, updated_at DESC);

ALTER TABLE public.project_presets ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_presets TO authenticated;

CREATE POLICY project_presets_select ON public.project_presets
	FOR SELECT TO authenticated
	USING (company_id = public.current_company_id());

CREATE POLICY project_presets_write ON public.project_presets
	FOR ALL TO authenticated
	USING (company_id = public.current_company_id() AND public.can_manage_costs())
	WITH CHECK (company_id = public.current_company_id() AND public.can_manage_costs());

CREATE TRIGGER project_presets_updated_at
	BEFORE UPDATE ON public.project_presets
	FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
