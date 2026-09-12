ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS monthly_salary numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salary_currency text NOT NULL DEFAULT 'USD';

UPDATE public.employees e
SET monthly_salary = e.annual_salary / 12,
    salary_currency = c.currency
FROM public.companies c
WHERE e.company_id = c.id
  AND (e.monthly_salary = 0 OR e.salary_currency = 'USD');

CREATE OR REPLACE FUNCTION public.company_employee_rates()
RETURNS TABLE (
  id uuid, name text, job_title text, department text,
  seniority text, skills text[], active boolean, hourly_cost numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (SELECT public.current_company_id() AS cid),
  company AS (SELECT currency FROM public.companies WHERE id = (SELECT cid FROM c)),
  p AS (SELECT * FROM public.cost_policies WHERE company_id = (SELECT cid FROM c) LIMIT 1),
  n AS (SELECT GREATEST(COUNT(*), 1)::numeric AS cnt FROM public.employees
        WHERE company_id = (SELECT cid FROM c) AND active),
  oh AS (SELECT COALESCE(SUM(CASE WHEN period = 'yearly' THEN monthly_amount ELSE monthly_amount * 12 END), 0) AS annual
         FROM public.overheads WHERE company_id = (SELECT cid FROM c)),
  rates AS (
    SELECT
      CASE currency
        WHEN 'PKR' THEN 0.00358 WHEN 'AED' THEN 0.2723 WHEN 'GBP' THEN 1.27
        WHEN 'EUR' THEN 1.08 WHEN 'SAR' THEN 0.2667 WHEN 'CAD' THEN 0.74
        WHEN 'AUD' THEN 0.66 WHEN 'INR' THEN 0.012 WHEN 'QAR' THEN 0.2747
        ELSE 1
      END AS usd_rate
    FROM company
  )
  SELECT e.id, e.name, e.job_title, e.department, e.seniority, e.skills, e.active,
    CASE WHEN (p.working_days_per_year * p.hours_per_day *
        (COALESCE(NULLIF(e.billable_target_pct, 0), p.default_utilization_pct) / 100.0)) > 0
      THEN round((
        (e.annual_salary * CASE e.salary_currency
          WHEN 'PKR' THEN 0.00358 WHEN 'AED' THEN 0.2723 WHEN 'GBP' THEN 1.27
          WHEN 'EUR' THEN 1.08 WHEN 'SAR' THEN 0.2667 WHEN 'CAD' THEN 0.74
          WHEN 'AUD' THEN 0.66 WHEN 'INR' THEN 0.012 WHEN 'QAR' THEN 0.2747
          ELSE 1 END / rates.usd_rate) * (1 + e.employer_cost_pct / 100.0)
        + (oh.annual / n.cnt))
        / (p.working_days_per_year * p.hours_per_day *
          (COALESCE(NULLIF(e.billable_target_pct, 0), p.default_utilization_pct) / 100.0)), 2)
      ELSE 0 END
  FROM public.employees e, p, n, oh, rates
  WHERE e.company_id = (SELECT cid FROM c)
  ORDER BY e.name
$$;