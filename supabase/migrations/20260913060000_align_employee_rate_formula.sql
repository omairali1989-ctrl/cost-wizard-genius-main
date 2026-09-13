-- Align company_employee_rates() with src/lib/pricing.ts hourlyCostFor().
-- Four divergences are corrected here:
--   1. NULL employer_cost_pct made the whole expression NULL, so hourly_cost came back NULL.
--   2. NULLIF(billable_target_pct, 0) treated an explicit 0% (a non-billable hire) as "unset"
--      and substituted the workspace utilization, giving that person a billable rate.
--   3. Inactive staff received a full active-headcount share of overhead, allocating more
--      overhead than the company carries.
--   4. Salary read annual_salary directly, ignoring monthly_salary, which the app treats as
--      the primary input.
-- SGD and ZAR are added to the FX map; both are offered by the workspace setup picker and
-- previously fell through to ELSE 1, i.e. were valued as US dollars.

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
        WHEN 'SGD' THEN 0.74 WHEN 'ZAR' THEN 0.055
        ELSE 1
      END AS usd_rate
    FROM company
  ),
  e AS (
    SELECT
      emp.*,
      -- An explicit 0 means genuinely non-billable and is preserved; only a NULL
      -- target falls back to the workspace default.
      LEAST(GREATEST(
        COALESCE(emp.billable_target_pct, (SELECT default_utilization_pct FROM p), 75)
      , 0), 100) AS billable_share_pct,
      GREATEST(COALESCE(emp.monthly_salary, 0) * 12, COALESCE(emp.annual_salary, 0)) AS annual_pay,
      LEAST(GREATEST(COALESCE(emp.employer_cost_pct, 0), 0), 200) AS employer_pct
    FROM public.employees emp
    WHERE emp.company_id = (SELECT cid FROM c)
  )
  SELECT e.id, e.name, e.job_title, e.department, e.seniority, e.skills, e.active,
    CASE WHEN (p.working_days_per_year * p.hours_per_day * (e.billable_share_pct / 100.0)) > 0
      THEN round((
        (e.annual_pay * CASE e.salary_currency
          WHEN 'PKR' THEN 0.00358 WHEN 'AED' THEN 0.2723 WHEN 'GBP' THEN 1.27
          WHEN 'EUR' THEN 1.08 WHEN 'SAR' THEN 0.2667 WHEN 'CAD' THEN 0.74
          WHEN 'AUD' THEN 0.66 WHEN 'INR' THEN 0.012 WHEN 'QAR' THEN 0.2747
          WHEN 'SGD' THEN 0.74 WHEN 'ZAR' THEN 0.055
          ELSE 1 END / rates.usd_rate) * (1 + e.employer_pct / 100.0)
        + CASE WHEN e.active THEN oh.annual / n.cnt ELSE 0 END)
        / (p.working_days_per_year * p.hours_per_day * (e.billable_share_pct / 100.0)), 2)
      ELSE 0 END
  FROM e, p, n, oh, rates
  ORDER BY e.name
$$;
