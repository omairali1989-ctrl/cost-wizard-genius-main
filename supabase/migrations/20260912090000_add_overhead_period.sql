ALTER TABLE public.overheads
  ADD COLUMN IF NOT EXISTS period text NOT NULL DEFAULT 'monthly';

ALTER TABLE public.overheads
  ADD CONSTRAINT overheads_period_check CHECK (period IN ('monthly', 'yearly'));