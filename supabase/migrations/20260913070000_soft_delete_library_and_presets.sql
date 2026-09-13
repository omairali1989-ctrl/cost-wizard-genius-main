-- Soft delete for the scope feature library and project blueprints.
-- Removing a template used to be permanent, which made tenants reluctant to tidy
-- their library. Archiving hides it from pickers while keeping it restorable.

ALTER TABLE public.scope_features
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.project_presets
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS scope_features_active_idx
  ON public.scope_features (company_id, sort_order)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS project_presets_active_idx
  ON public.project_presets (company_id, updated_at DESC)
  WHERE archived_at IS NULL;
