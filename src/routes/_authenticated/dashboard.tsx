import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import {
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Clock,
  Briefcase,
  Layers,
  Target,
  ArrowRight,
  ChevronRight,
  AlertTriangle,
  Flame,
  CalendarDays,
  Receipt,
  PieChart,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { PageHeader } from "@/components/AppShell";
import { StatCard } from "@/components/ui/stat-card";
import {
  useEmployees,
  useOverheads,
  useTeamRates,
  type WorkspaceData,
} from "@/lib/workspace";
import {
  formatMoney,
  annualSalaryAmount,
  monthlyOverheadAmount,
  overheadPerEmployeeAnnual,
  type CalculationResults,
  type EmployeeRecord,
  type OverheadRecord,
  HOURS_PER_MONTH,
} from "@/lib/pricing";
import { convertCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Alisons Technology" },
      { name: "description", content: "Live financial intelligence dashboard." },
      { property: "og:title", content: "Dashboard — Alisons Technology" },
    ],
  }),
  component: () => (
    <WorkspaceGate>{(ws) => <DashboardInner workspace={ws} />}</WorkspaceGate>
  ),
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface CalcRow {
  id: string;
  label: string;
  version: number;
  results: unknown;
  created_at: string;
  project_id: string | null;
  projects: { name?: string; client_name?: string } | null;
}

// ─── Pure helpers (all dynamic — zero hardcoded values) ───────────────────────

/** Monthly gross salary cost for one employee (salary / 12 × employer burden) */
function monthlyLoadedCost(emp: EmployeeRecord, baseCurrency: string): number {
  const annual = convertCurrency(annualSalaryAmount(emp), emp.salary_currency || baseCurrency, baseCurrency);
  const burden = 1 + Number(emp.employer_cost_pct || 0) / 100;
  return (annual * burden) / 12;
}

/** Total monthly payroll burn across all active employees */
function monthlyPayroll(employees: EmployeeRecord[], baseCurrency: string): number {
  return employees.filter((e) => e.active).reduce((s, e) => s + monthlyLoadedCost(e, baseCurrency), 0);
}

/** Group estimates by calendar month key "YYYY-MM" */
function groupByMonth(calcs: CalcRow[]): Record<string, CalcRow[]> {
  return calcs.reduce(
    (acc, c) => {
      const key = c.created_at.slice(0, 7); // "YYYY-MM"
      if (!acc[key]) acc[key] = [];
      acc[key].push(c);
      return acc;
    },
    {} as Record<string, CalcRow[]>
  );
}

/** Last N month keys sorted ascending */
function lastNMonthKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

/** Format a YYYY-MM key as "Jan 25" */
function fmtMonthKey(key: string): string {
  const parts = key.split("-").map(Number);
  const y = parts[0] ?? 2024;
  const m = parts[1] ?? 1;
  return new Date(y, m - 1, 1).toLocaleString("default", {
    month: "short",
    year: "2-digit",
  });
}

// ─── Main component ───────────────────────────────────────────────────────────
function DashboardInner({ workspace }: { workspace: WorkspaceData }) {
  const companyId = workspace.company!.id;
  const currency = workspace.company!.currency;
  const policy = workspace.policy;

  const { data: employees = [] } = useEmployees(companyId);
  const { data: overheads = [] } = useOverheads(companyId);
  const { data: teamRates = [] } = useTeamRates(companyId);

  const { data: calcs = [] } = useQuery<CalcRow[]>({
    queryKey: ["calculations-dashboard", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calculations")
        .select(
          "id, label, version, results, created_at, project_id, projects(name, client_name)"
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(60); // 5 years worth of monthly data
      if (error) throw error;
      return (data ?? []) as CalcRow[];
    },
  });

  // ─── Dynamic cost computations ────────────────────────────────────────────
  const activeEmployees = React.useMemo(
    () => employees.filter((e) => e.active),
    [employees]
  );
  const activeCount = activeEmployees.length;

  // Monthly overhead (fully dynamic from DB)
  const monthlyOverhead = React.useMemo(
    () => overheads.reduce((s, o) => s + monthlyOverheadAmount(o), 0),
    [overheads]
  );

  // Monthly payroll burden (dynamic from each employee's salary + employer cost %)
  const monthlyPayrollBurn = React.useMemo(
    () => monthlyPayroll(activeEmployees, currency),
    [activeEmployees, currency]
  );

  // Total monthly burn = payroll + overheads
  const totalMonthlyBurn = monthlyPayrollBurn + monthlyOverhead;

  // Annual totals
  const annualPayroll = monthlyPayrollBurn * 12;
  const annualOverhead = monthlyOverhead * 12;
  const annualBurn = totalMonthlyBurn * 12;

  // Overhead absorbed per person per year
  const overheadPerPerson = overheadPerEmployeeAnnual(overheads, activeCount);

  // Average hourly cost across team (from team-rates RPC)
  const avgHourlyCost =
    teamRates.length > 0
      ? teamRates.reduce((s, t) => s + t.hourly_cost, 0) / teamRates.length
      : 0;

  // Break-even monthly revenue needed to cover burn
  const breakEvenMonthly = totalMonthlyBurn;

  // Hours available per month at 100% billability
  const hoursAvailablePerMonth = activeCount * HOURS_PER_MONTH;

  // Department cost breakdown (dynamic)
  const deptCosts = React.useMemo(() => {
    const map: Record<string, { count: number; monthlyBurn: number }> = {};
    for (const e of activeEmployees) {
      const dept = e.department || "Other";
      if (!map[dept]) map[dept] = { count: 0, monthlyBurn: 0 };
      map[dept].count += 1;
      map[dept].monthlyBurn += monthlyLoadedCost(e, currency);
    }
    return Object.entries(map)
      .map(([dept, v]) => ({ dept, ...v }))
      .sort((a, b) => b.monthlyBurn - a.monthlyBurn);
  }, [activeEmployees]);

  // Per-employee monthly cost table
  const employeeMonthlyCosts = React.useMemo(
    () =>
      activeEmployees
        .map((e) => ({
          emp: e,
          monthly: monthlyLoadedCost(e, currency),
          annual: monthlyLoadedCost(e, currency) * 12,
        }))
        .sort((a, b) => b.monthly - a.monthly),
    [activeEmployees]
  );

  // Estimate pipeline aggregates
  const results: CalculationResults[] = React.useMemo(
    () =>
      calcs
        .map((c) => c.results as unknown as CalculationResults)
        .filter(Boolean),
    [calcs]
  );

  const pipeline = results.reduce((s, r) => s + (r?.price ?? 0), 0);
  const totalLaborCost = results.reduce((s, r) => s + (r?.laborCost ?? 0), 0);
  const totalProfit = results.reduce((s, r) => s + (r?.profit ?? 0), 0);
  const totalHours = results.reduce((s, r) => s + (r?.totalHours ?? 0), 0);
  const avgMargin =
    results.length > 0
      ? results.reduce((s, r) => s + (r?.marginPct ?? 0), 0) / results.length
      : 0;
  const totalCommission = results.reduce(
    (s, r) => s + (r?.salesCommissionAmount ?? 0),
    0
  );
  const netProfit = results.reduce(
    (s, r) => s + (r?.netProfitAfterCommission ?? 0),
    0
  );

  // Month-by-month pipeline (last 6 months)
  const byMonth = React.useMemo(() => groupByMonth(calcs), [calcs]);
  const last6Months = lastNMonthKeys(6);
  const monthlyPipelineData = last6Months.map((key) => {
    const rows = byMonth[key] ?? [];
    const value = rows.reduce(
      (s, c) => s + ((c.results as unknown as CalculationResults)?.price ?? 0),
      0
    );
    return { key, label: fmtMonthKey(key), value, count: rows.length };
  });
  const maxMonthlyPipeline = Math.max(...monthlyPipelineData.map((d) => d.value), 1);

  // This month vs last month
  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

  const thisMonthCalcs = byMonth[thisMonthKey] ?? [];
  const lastMonthCalcs = byMonth[lastMonthKey] ?? [];
  const thisMonthPipeline = monthlyPipelineData.find((d) => d.key === thisMonthKey)?.value ?? 0;
  const lastMonthPipeline = monthlyPipelineData.find((d) => d.key === lastMonthKey)?.value ?? 0;

  const pipelineTrend: "up" | "down" | "flat" =
    lastMonthPipeline === 0
      ? "flat"
      : thisMonthPipeline >= lastMonthPipeline
      ? "up"
      : "down";
  const pipelineTrendPct =
    lastMonthPipeline > 0
      ? Math.abs(((thisMonthPipeline - lastMonthPipeline) / lastMonthPipeline) * 100).toFixed(0)
      : null;

  // Pipeline coverage ratio (how many months of burn is the pipeline worth)
  const pipelineCoverageMonths =
    totalMonthlyBurn > 0 ? (pipeline / totalMonthlyBurn).toFixed(1) : "∞";

  // Top estimate
  const topCalc =
    calcs.length > 0
      ? calcs.reduce((best, c) => {
          const r = c.results as unknown as CalculationResults;
          const bestR = best.results as unknown as CalculationResults;
          return (r?.price ?? 0) > (bestR?.price ?? 0) ? c : best;
        })
      : null;

  const recentCalcs = calcs.slice(0, 8);

  // ─── Overhead category groups ─────────────────────────────────────────────
  const overheadByCategory = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of overheads) {
      const cat = o.category || "Uncategorised";
      map[cat] = (map[cat] || 0) + monthlyOverheadAmount(o);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [overheads]);

  return (
    <>
      <PageHeader
        title={`Welcome, ${workspace.fullName?.split(" ")[0] ?? "there"} 👋`}
        description={`${workspace.company!.name} · Live Financial Intelligence`}
        action={
          <Button asChild>
            <Link to="/calculator" className="gap-2">
              New Estimate <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1 — Monthly Burn Rate KPIs (all dynamic)
      ═══════════════════════════════════════════════════════════════════════ */}
      <SectionLabel icon={<Flame className="size-3.5 text-red-500" />} label="Monthly Burn Rate" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Monthly Burn"
          value={formatMoney(totalMonthlyBurn, currency)}
          hint={`${formatMoney(annualBurn, currency)} / year`}
          icon={<Flame className="size-3.5" />}
          accent="red"
          trend={totalMonthlyBurn > pipeline / 6 ? "down" : "flat"}
          trendLabel={totalMonthlyBurn > pipeline / 6 ? "Burn exceeds pipeline pace" : undefined}
        />
        <StatCard
          label="Monthly Payroll Burden"
          value={formatMoney(monthlyPayrollBurn, currency)}
          hint={`${activeCount} active · incl. employer costs`}
          icon={<Users className="size-3.5" />}
          accent="amber"
        />
        <StatCard
          label="Monthly Fixed Overheads"
          value={formatMoney(monthlyOverhead, currency)}
          hint={`${formatMoney(annualOverhead, currency)} / year`}
          icon={<Layers className="size-3.5" />}
          accent="purple"
        />
        <StatCard
          label="Break-Even Revenue / Month"
          value={formatMoney(breakEvenMonthly, currency)}
          hint={`${pipelineCoverageMonths} months pipeline coverage`}
          icon={<Target className="size-3.5" />}
          accent={Number(pipelineCoverageMonths) >= 3 ? "green" : "red"}
          trend={Number(pipelineCoverageMonths) >= 3 ? "up" : "down"}
          trendLabel={`${pipelineCoverageMonths}× covered`}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2 — Pipeline Analytics KPIs
      ═══════════════════════════════════════════════════════════════════════ */}
      <SectionLabel icon={<TrendingUp className="size-3.5 text-emerald-500" />} label="Estimate Pipeline Analytics" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Pipeline (all estimates)"
          value={formatMoney(pipeline, currency)}
          hint={`${calcs.length} saved estimates`}
          icon={<TrendingUp className="size-3.5" />}
          accent="green"
          trend={pipelineTrend}
          trendLabel={
            pipelineTrendPct ? `${pipelineTrendPct}% vs last month` : undefined
          }
        />
        <StatCard
          label="Avg Profit Margin"
          value={`${avgMargin.toFixed(1)}%`}
          hint={avgMargin >= 25 ? "Healthy" : "Below 25% target"}
          icon={<Target className="size-3.5" />}
          accent={avgMargin >= 25 ? "green" : avgMargin >= 15 ? "amber" : "red"}
          trend={avgMargin >= 25 ? "up" : avgMargin >= 15 ? "flat" : "down"}
          trendLabel={avgMargin >= 25 ? "On target" : "Needs attention"}
        />
        <StatCard
          label="Net Profit (after commission)"
          value={formatMoney(netProfit, currency)}
          hint={`${formatMoney(totalCommission, currency)} Ayesha commission`}
          icon={<DollarSign className="size-3.5" />}
          accent={netProfit >= 0 ? "green" : "red"}
        />
        <StatCard
          label="Total Billable Hours Scoped"
          value={`${Math.round(totalHours).toLocaleString()} hrs`}
          hint={`≈ ${(totalHours / HOURS_PER_MONTH).toFixed(1)} person-months`}
          icon={<Clock className="size-3.5" />}
          accent="blue"
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3 — Monthly Pipeline Trend (6-month bar chart)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              Monthly Pipeline Trend — Last 6 Months
            </CardTitle>
            <CardDescription>
              Estimate value created per calendar month vs monthly burn{" "}
              <span className="font-semibold text-foreground">
                ({formatMoney(totalMonthlyBurn, currency)}/mo)
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-40 w-full">
              {monthlyPipelineData.map((d) => {
                const pct = Math.max(4, (d.value / maxMonthlyPipeline) * 100);
                const burnPct = Math.min(
                  100,
                  (totalMonthlyBurn / maxMonthlyPipeline) * 100
                );
                const isCurrent = d.key === thisMonthKey;
                const coversBurn = d.value >= totalMonthlyBurn;
                return (
                  <div
                    key={d.key}
                    className="flex-1 flex flex-col items-center gap-1.5 group"
                  >
                    <div className="text-[10px] font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      {d.count > 0 ? formatMoney(d.value, currency) : "—"}
                    </div>
                    <div className="w-full flex-1 flex items-end relative">
                      {/* Burn line marker */}
                      <div
                        className="absolute w-full border-t-2 border-dashed border-red-400/60"
                        style={{ bottom: `${burnPct}%` }}
                        title={`Monthly burn: ${formatMoney(totalMonthlyBurn, currency)}`}
                      />
                      {/* Bar */}
                      <div
                        className={cn(
                          "w-full rounded-t-md transition-all duration-700",
                          d.count === 0
                            ? "bg-muted/40"
                            : isCurrent
                            ? "bg-primary"
                            : coversBurn
                            ? "bg-emerald-500"
                            : "bg-amber-500"
                        )}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <div className="text-center">
                      <p
                        className={cn(
                          "text-[11px] font-semibold",
                          isCurrent ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        {d.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {d.count} est.
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500 shrink-0" />
                Above burn
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-500 shrink-0" />
                Below burn
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-primary shrink-0" />
                This month
              </span>
              <span className="flex items-center gap-1.5 ml-auto">
                <span className="h-0 w-5 border-t-2 border-dashed border-red-400" />
                Monthly burn ({formatMoney(totalMonthlyBurn, currency)})
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Waterfall */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="size-4 text-emerald-500" />
              Revenue Waterfall
            </CardTitle>
            <CardDescription>All estimates aggregated</CardDescription>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Save an estimate to see the waterfall
              </p>
            ) : (
              <div className="space-y-3">
                {(
                  [
                    { label: "Quote (Pipeline)", value: pipeline, color: "bg-primary" },
                    { label: "Labor Cost", value: totalLaborCost, color: "bg-blue-500" },
                    { label: "Gross Profit", value: totalProfit, color: totalProfit >= 0 ? "bg-emerald-500" : "bg-red-500" },
                    { label: "Ayesha Commission", value: totalCommission, color: "bg-amber-500" },
                    { label: "Net Profit", value: netProfit, color: netProfit >= 0 ? "bg-emerald-600" : "bg-red-600" },
                  ] as const
                ).map(({ label, value, color }) => {
                  const barPct = pipeline > 0
                    ? Math.max(4, Math.min(100, (Math.abs(value) / pipeline) * 100))
                    : 0;
                  return (
                    <div key={label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{label}</span>
                        <span className={cn("font-mono font-semibold", value < 0 ? "text-red-500" : "text-foreground")}>
                          {formatMoney(value, currency)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${barPct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4 — Per-Department Monthly Cost + Overhead Breakdown
      ═══════════════════════════════════════════════════════════════════════ */}
      <SectionLabel icon={<PieChart className="size-3.5 text-blue-500" />} label="Cost by Department & Overhead" />
      <div className="mb-6 grid gap-4 lg:grid-cols-3">

        {/* Per-department monthly cost */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-sm font-semibold flex items-center gap-2">
              <Briefcase className="size-4 text-blue-500" />
              Monthly Cost by Department
            </CardTitle>
            <CardDescription>Payroll burden incl. employer costs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {deptCosts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No active employees</p>
            ) : (
              deptCosts.map(({ dept, count, monthlyBurn }) => {
                const pct = monthlyPayrollBurn > 0
                  ? Math.round((monthlyBurn / monthlyPayrollBurn) * 100)
                  : 0;
                return (
                  <div key={dept} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{dept}</span>
                      <div className="text-right">
                        <span className="font-mono font-semibold text-foreground">
                          {formatMoney(monthlyBurn, currency)}
                        </span>
                        <span className="text-muted-foreground text-[10px] block">
                          {count} people · {pct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
            <div className="pt-2 border-t mt-2 flex items-center justify-between text-xs font-semibold">
              <span>Total / month</span>
              <span className="font-mono text-blue-600 dark:text-blue-400">
                {formatMoney(monthlyPayrollBurn, currency)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Overhead line-item breakdown */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-sm font-semibold flex items-center gap-2">
              <Layers className="size-4 text-amber-500" />
              Overhead Breakdown
            </CardTitle>
            <CardDescription>Fixed monthly costs by item</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {overheads.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No overheads configured</p>
            ) : (
              overheads.map((o) => {
                const monthlyAmount = monthlyOverheadAmount(o);
                const pct = monthlyOverhead > 0
                  ? Math.round((monthlyAmount / monthlyOverhead) * 100)
                  : 0;
                return (
                  <div key={o.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{o.name}</p>
                        {o.category && (
                          <p className="text-muted-foreground text-[10px]">{o.category}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="font-mono font-semibold">
                          {formatMoney(monthlyAmount, currency)}
                        </span>
                        <span className="text-muted-foreground text-[10px] block">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
            <div className="pt-2 border-t flex items-center justify-between text-xs font-semibold">
              <span>Total / month</span>
              <span className="font-mono text-amber-600 dark:text-amber-400">
                {formatMoney(monthlyOverhead, currency)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Combined burn summary */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-sm font-semibold flex items-center gap-2">
              <Wallet className="size-4 text-red-500" />
              Monthly Burn Summary
            </CardTitle>
            <CardDescription>Full cost visibility</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(
              [
                {
                  label: "Payroll (with burden)",
                  value: monthlyPayrollBurn,
                  annual: annualPayroll,
                  color: "bg-blue-500",
                },
                {
                  label: "Fixed Overheads",
                  value: monthlyOverhead,
                  annual: annualOverhead,
                  color: "bg-amber-500",
                },
              ] as const
            ).map(({ label, value, annual, color }) => {
              const pct = totalMonthlyBurn > 0
                ? Math.round((value / totalMonthlyBurn) * 100)
                : 0;
              return (
                <div key={label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono font-semibold">
                      {formatMoney(value, currency)}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground text-right">
                    {formatMoney(annual, currency)} / year · {pct}% of burn
                  </p>
                </div>
              );
            })}

            {/* Key metrics grid */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t">
              {(
                [
                  { label: "Total / month", value: formatMoney(totalMonthlyBurn, currency), highlight: true },
                  { label: "Total / year", value: formatMoney(annualBurn, currency), highlight: false },
                  { label: "Cost / person / mo", value: activeCount > 0 ? formatMoney(totalMonthlyBurn / activeCount, currency) : "—", highlight: false },
                  { label: "Avg hourly cost", value: formatMoney(avgHourlyCost, currency), highlight: false },
                  { label: "Hours avail. / mo", value: `${hoursAvailablePerMonth.toLocaleString()} h`, highlight: false },
                  { label: "Overhead / person / yr", value: formatMoney(overheadPerPerson, currency), highlight: false },
                ] as const
              ).map(({ label, value, highlight }) => (
                <div
                  key={label}
                  className={cn(
                    "rounded-lg p-2 text-xs",
                    highlight ? "bg-red-500/10 border border-red-200 dark:border-red-800" : "bg-muted/40"
                  )}
                >
                  <p className="text-muted-foreground">{label}</p>
                  <p className={cn("font-bold font-mono mt-0.5", highlight ? "text-red-600 dark:text-red-400" : "text-foreground")}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 5 — Per-Employee Monthly Cost Table (dynamic)
      ═══════════════════════════════════════════════════════════════════════ */}
      <SectionLabel icon={<Receipt className="size-3.5 text-purple-500" />} label="Per-Employee Monthly Cost (Dynamic)" />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-display text-sm font-semibold">
            Individual Monthly Cost Breakdown
          </CardTitle>
          <CardDescription>
            Gross salary ÷ 12 × employer burden % — sorted by highest cost.
            All values recalculate automatically when salaries change.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 divide-y">
          {employeeMonthlyCosts.length === 0 ? (
            <p className="p-6 text-center text-xs text-muted-foreground">No active employees</p>
          ) : (
            employeeMonthlyCosts.map(({ emp, monthly, annual }) => {
              const pct = monthlyPayrollBurn > 0
                ? Math.round((monthly / monthlyPayrollBurn) * 100)
                : 0;
              return (
                <div
                  key={emp.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm hover:bg-muted/20 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{emp.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {emp.job_title ?? "—"} · {emp.department ?? "—"} ·{" "}
                      <span className="font-mono">
                        {emp.employer_cost_pct}% burden
                      </span>
                    </p>
                    <div className="mt-1.5 h-1 bg-muted rounded-full w-full max-w-[200px] overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-6 shrink-0 text-right">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Monthly</p>
                      <p className="font-bold font-mono text-base text-primary">
                        {formatMoney(monthly, currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Annual (loaded)</p>
                      <p className="font-semibold font-mono text-sm text-foreground">
                        {formatMoney(annual, currency)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-800"
                    >
                      {pct}% of payroll
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
          <div className="flex items-center justify-between px-4 py-3 bg-muted/30 text-sm font-semibold">
            <span>Total Active Payroll</span>
            <span className="font-mono text-primary">
              {formatMoney(monthlyPayrollBurn, currency)} / month
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 6 — Spotlight + This Month + Recent Estimates
      ═══════════════════════════════════════════════════════════════════════ */}
      {(topCalc || thisMonthCalcs.length > 0) && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          {topCalc && (() => {
            const r = topCalc.results as unknown as CalculationResults;
            return (
              <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-background">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Target className="size-4 text-primary" />
                    <CardTitle className="font-display text-sm font-semibold">
                      🏆 Highest Value Estimate
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="font-semibold text-foreground">
                      {(topCalc.projects as { name?: string } | null)?.name ?? "Untitled"} · {topCalc.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(topCalc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {(
                      [
                        { label: "Quote", val: formatMoney(r?.price ?? 0, currency) },
                        { label: "Margin", val: `${(r?.marginPct ?? 0).toFixed(1)}%` },
                        { label: "Hours", val: `${Math.round(r?.totalHours ?? 0)}h` },
                      ] as const
                    ).map(({ label, val }) => (
                      <div key={label} className="rounded-lg bg-card border p-2 text-center">
                        <p className="text-muted-foreground">{label}</p>
                        <p className="font-bold font-mono mt-0.5 text-primary">{val}</p>
                      </div>
                    ))}
                  </div>
                  {topCalc.project_id && (
                    <Button asChild size="sm" variant="outline" className="w-full">
                      <Link to="/projects/$id" params={{ id: topCalc.project_id }} className="gap-1.5">
                        Open Project <ChevronRight className="size-3.5" />
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-blue-500" />
                <CardTitle className="font-display text-sm font-semibold">
                  This Month Snapshot
                </CardTitle>
              </div>
              <CardDescription>
                {now.toLocaleString("default", { month: "long", year: "numeric" })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {thisMonthCalcs.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No estimates this month yet.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-muted/40 border p-2.5">
                      <p className="text-muted-foreground">Estimates</p>
                      <p className="font-bold text-lg font-mono mt-0.5">{thisMonthCalcs.length}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 border p-2.5">
                      <p className="text-muted-foreground">Pipeline Value</p>
                      <p className="font-bold text-sm font-mono mt-0.5 text-primary">
                        {formatMoney(thisMonthPipeline, currency)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/40 border p-2.5">
                      <p className="text-muted-foreground">vs Monthly Burn</p>
                      <p className={cn("font-bold text-sm font-mono mt-0.5",
                        thisMonthPipeline >= totalMonthlyBurn ? "text-emerald-600" : "text-red-500"
                      )}>
                        {thisMonthPipeline >= totalMonthlyBurn ? "✓ Covers burn" : "⚠ Below burn"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/40 border p-2.5">
                      <p className="text-muted-foreground">Coverage Ratio</p>
                      <p className="font-bold text-sm font-mono mt-0.5">
                        {totalMonthlyBurn > 0
                          ? `${(thisMonthPipeline / totalMonthlyBurn).toFixed(1)}×`
                          : "∞"}
                      </p>
                    </div>
                  </div>
                  {lastMonthPipeline > 0 && (
                    <div className={cn(
                      "rounded-lg p-2.5 text-xs flex items-center gap-2",
                      pipelineTrend === "up"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "bg-red-500/10 text-red-700 dark:text-red-400"
                    )}>
                      {pipelineTrend === "up"
                        ? <TrendingUp className="size-3.5 shrink-0" />
                        : <AlertTriangle className="size-3.5 shrink-0" />}
                      <span className="font-medium">
                        {pipelineTrend === "up" ? "+" : "-"}{pipelineTrendPct}% vs last month ({formatMoney(lastMonthPipeline, currency)})
                      </span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 7 — Recent Estimates Table
      ═══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-display text-base">Recent Estimates</CardTitle>
            <CardDescription>Latest saved versions across all projects</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/calculator">+ New</Link>
          </Button>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {recentCalcs.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Nothing saved yet — build your first estimate.
            </p>
          )}
          {recentCalcs.map((c) => {
            const r = c.results as unknown as CalculationResults;
            const margin = r?.marginPct ?? 0;
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">
                    {(c.projects as { name?: string } | null)?.name ?? "Untitled"}{" "}
                    <span className="text-muted-foreground font-normal">· {c.label}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(c.created_at).toLocaleDateString()} ·{" "}
                    {Math.round(r?.totalHours ?? 0)} hrs ·{" "}
                    {(r?.blendedRate ?? 0) > 0 && `${formatMoney(r.blendedRate, currency)}/hr blended`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-semibold",
                      margin >= 25
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800"
                        : "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800"
                    )}
                  >
                    {margin.toFixed(1)}% margin
                  </Badge>
                  <span className="font-display font-bold tabular-nums text-primary">
                    {formatMoney(r?.price ?? 0, currency)}
                  </span>
                  {c.project_id && (
                    <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                      <Link to="/projects/$id" params={{ id: c.project_id }} className="gap-1">
                        Open <ChevronRight className="size-3" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}

// ─── Helper: section label ────────────────────────────────────────────────────
function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-1">
      {icon}
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
