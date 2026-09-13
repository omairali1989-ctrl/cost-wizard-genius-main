import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CircleCheck,
  Clock3,
  Gauge,
  LineChart,
  ShieldAlert,
  Target,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { convertCurrency } from "@/lib/currency";
import { formatMoney, type CalculationInputs, type CalculationResults } from "@/lib/pricing";
import {
  normalizeProjectStatus,
  summarizeProjectRevenue,
  type ProjectStatus,
} from "@/lib/project-status";
import type { WorkspaceData } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusSelect";

export const Route = createFileRoute("/_authenticated/business-intelligence")({
  head: () => ({
    meta: [
      { title: "Business intelligence — CostCraft" },
      {
        name: "description",
        content: "Commercial performance, project risk, and pricing intelligence.",
      },
    ],
  }),
  component: () => (
    <WorkspaceGate>{(workspace) => <BusinessIntelligence workspace={workspace} />}</WorkspaceGate>
  ),
});

type RangeMonths = 3 | 6 | 12;
type PortfolioFilter = "all" | "attention";

interface CalculationRow {
  id: string;
  project_id: string | null;
  label: string;
  version: number;
  inputs: unknown;
  results: unknown;
  created_at: string;
  projects: {
    id?: string;
    name?: string;
    client_name?: string;
    status?: string;
  } | null;
}

interface PortfolioProject {
  id: string;
  projectId: string | null;
  name: string;
  client: string;
  status: ProjectStatus;
  label: string;
  version: number;
  createdAt: string;
  price: number;
  totalCost: number;
  profit: number;
  netProfit: number;
  marginPct: number;
  hours: number;
  infeasible: boolean;
}

interface TrendPoint {
  key: string;
  month: string;
  pipeline: number;
  profit: number;
  margin: number;
  projects: number;
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function rangeKeys(months: number): string[] {
  const now = new Date();
  return Array.from({ length: months }, (_, index) => {
    const offset = months - index - 1;
    return monthKey(new Date(now.getFullYear(), now.getMonth() - offset, 1));
  });
}

function compactMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function riskFor(project: PortfolioProject, targetMargin: number) {
  if (project.infeasible || project.netProfit < 0) {
    return {
      level: "critical" as const,
      label: "Critical",
      reason: project.infeasible ? "Pricing target is infeasible" : "Negative net profit",
    };
  }
  if (project.marginPct < targetMargin * 0.6) {
    return {
      level: "high" as const,
      label: "High",
      reason: `${(targetMargin - project.marginPct).toFixed(1)} pts below target`,
    };
  }
  if (project.marginPct < targetMargin) {
    return {
      level: "medium" as const,
      label: "Watch",
      reason: `${(targetMargin - project.marginPct).toFixed(1)} pts below target`,
    };
  }
  return { level: "healthy" as const, label: "Healthy", reason: "At or above target" };
}

function BusinessIntelligence({ workspace }: { workspace: WorkspaceData }) {
  const companyId = workspace.company!.id;
  const currency = workspace.company!.currency;
  const targetMargin = Number(workspace.policy?.default_margin_pct ?? 25);
  const [range, setRange] = useState<RangeMonths>(6);
  const [portfolioFilter, setPortfolioFilter] = useState<PortfolioFilter>("all");

  const {
    data = [],
    isLoading,
    error,
  } = useQuery<CalculationRow[]>({
    queryKey: ["business-intelligence", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calculations")
        .select(
          "id, project_id, label, version, inputs, results, created_at, projects(id, name, client_name, status)",
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CalculationRow[];
    },
  });

  const latestProjects = useMemo(() => {
    const latest = new Map<string, CalculationRow>();
    for (const calculation of data) {
      const key = calculation.project_id ?? calculation.id;
      const current = latest.get(key);
      if (!current || calculation.version > current.version) latest.set(key, calculation);
    }
    return [...latest.values()].map((calculation): PortfolioProject => {
      const results = calculation.results as CalculationResults | null;
      const inputs = calculation.inputs as CalculationInputs | null;
      const sourceCurrency = inputs?.currency || currency;
      const money = (value: unknown) => convertCurrency(number(value), sourceCurrency, currency);
      return {
        id: calculation.id,
        projectId: calculation.project_id,
        name: calculation.projects?.name ?? "Untitled project",
        client: calculation.projects?.client_name ?? "No client",
        status: normalizeProjectStatus(calculation.projects?.status),
        label: calculation.label,
        version: calculation.version,
        createdAt: calculation.created_at,
        price: money(results?.price),
        totalCost: money(results?.totalCost),
        profit: money(results?.profit),
        netProfit: money(results?.netProfitAfterCommission ?? results?.profit),
        marginPct: number(results?.marginPct),
        hours: number(results?.totalHours),
        infeasible: results?.pricingInfeasible === true,
      };
    });
  }, [currency, data]);

  const keys = useMemo(() => rangeKeys(range), [range]);
  const periodProjects = useMemo(
    () => latestProjects.filter((project) => keys.includes(project.createdAt.slice(0, 7))),
    [keys, latestProjects],
  );

  const pipeline = periodProjects.reduce((sum, project) => sum + project.price, 0);
  const revenue = summarizeProjectRevenue(periodProjects);
  const revenueProjects = periodProjects.filter((project) =>
    ["approved", "in_progress", "completed"].includes(project.status),
  );
  const totalCost = periodProjects.reduce((sum, project) => sum + project.totalCost, 0);
  const profit = periodProjects.reduce((sum, project) => sum + project.profit, 0);
  const netProfit = periodProjects.reduce((sum, project) => sum + project.netProfit, 0);
  const weightedMargin = pipeline > 0 ? (profit / pipeline) * 100 : 0;
  const averageQuote = periodProjects.length ? pipeline / periodProjects.length : 0;
  const sortedByValue = [...periodProjects].sort((a, b) => b.price - a.price);
  const largestShare = pipeline > 0 ? ((sortedByValue[0]?.price ?? 0) / pipeline) * 100 : 0;
  const attentionProjects = periodProjects.filter(
    (project) => riskFor(project, targetMargin).level !== "healthy",
  );
  const criticalProjects = periodProjects.filter((project) => {
    const level = riskFor(project, targetMargin).level;
    return level === "critical" || level === "high";
  });

  const trend = useMemo<TrendPoint[]>(
    () =>
      keys.map((key) => {
        const monthProjects = periodProjects.filter(
          (project) => project.createdAt.slice(0, 7) === key,
        );
        const monthPipeline = monthProjects.reduce((sum, project) => sum + project.price, 0);
        const monthProfit = monthProjects.reduce((sum, project) => sum + project.profit, 0);
        const [year, month] = key.split("-").map(Number);
        return {
          key,
          month: new Date(year ?? 2026, (month ?? 1) - 1, 1).toLocaleDateString("en", {
            month: "short",
          }),
          pipeline: monthPipeline,
          profit: monthProfit,
          margin: monthPipeline > 0 ? (monthProfit / monthPipeline) * 100 : 0,
          projects: monthProjects.length,
        };
      }),
    [keys, periodProjects],
  );

  const currentMonth = trend.at(-1);
  const previousMonth = trend.at(-2);
  const pipelineChange =
    currentMonth && previousMonth?.pipeline
      ? ((currentMonth.pipeline - previousMonth.pipeline) / previousMonth.pipeline) * 100
      : null;

  const filteredPortfolio = [
    ...(portfolioFilter === "attention" ? attentionProjects : periodProjects),
  ].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, healthy: 3 } as const;
    const riskDelta = order[riskFor(a, targetMargin).level] - order[riskFor(b, targetMargin).level];
    return riskDelta || b.price - a.price;
  });

  const decision = (() => {
    if (!periodProjects.length) {
      return {
        tone: "neutral" as const,
        title: "There is no commercial baseline for this period yet.",
        body: "Save an estimate to begin tracking pipeline value, margin quality, and project risk.",
      };
    }
    if (criticalProjects.length) {
      return {
        tone: "risk" as const,
        title: `${criticalProjects.length} quote${criticalProjects.length === 1 ? " needs" : "s need"} pricing intervention.`,
        body: `Focus first on negative-profit or severely under-target work. Together, the flagged portfolio represents ${compactMoney(
          criticalProjects.reduce((sum, project) => sum + project.price, 0),
          currency,
        )} in pipeline value.`,
      };
    }
    if (attentionProjects.length) {
      return {
        tone: "watch" as const,
        title: `Margin is healthy overall, but ${attentionProjects.length} quote${attentionProjects.length === 1 ? " is" : "s are"} below target.`,
        body: `The portfolio is running at ${weightedMargin.toFixed(1)}% against a ${targetMargin.toFixed(1)}% target. Review the risk queue before the next client revision.`,
      };
    }
    if (largestShare >= 50) {
      return {
        tone: "watch" as const,
        title: "Pricing quality is on target; concentration is the next risk.",
        body: `The largest quote accounts for ${largestShare.toFixed(1)}% of the selected pipeline. Protect conversion while building more coverage around it.`,
      };
    }
    return {
      tone: "healthy" as const,
      title: "The selected portfolio is commercially on target.",
      body: `Weighted margin is ${weightedMargin.toFixed(1)}%, with no saved estimates currently requiring pricing intervention.`,
    };
  })();

  if (isLoading) return <BusinessIntelligenceLoading />;

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="py-10 text-center">
          <ShieldAlert className="mx-auto mb-3 size-6 text-destructive" />
          <p className="font-display font-semibold">Business intelligence could not load.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Refresh the page. If the problem continues, check calculation access for this role.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Business intelligence"
        description="Commercial performance and pricing risk from the latest saved project estimates."
        action={
          <div
            className="flex items-center gap-1 rounded-lg border bg-card p-1"
            aria-label="Period"
          >
            {([3, 6, 12] as const).map((months) => (
              <button
                key={months}
                type="button"
                onClick={() => setRange(months)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  range === months
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={range === months}
              >
                {months} months
              </button>
            ))}
          </div>
        }
      />

      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold">Revenue by project status</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Revenue is booked once a project is approved. Sent quotes remain pipeline; drafts are
            excluded.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Booked revenue:{" "}
          <strong className="text-foreground">
            {formatMoney(revenue.bookedRevenue, currency)}
          </strong>
        </p>
      </div>
      <section className="mb-6 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-5">
        <StatusMetric
          status="draft"
          value={revenue.draftValue}
          count={revenue.counts.draft}
          currency={currency}
        />
        <StatusMetric
          status="sent"
          value={revenue.sentPipeline}
          count={revenue.counts.sent}
          currency={currency}
        />
        <StatusMetric
          status="approved"
          value={revenue.approvedRevenue}
          count={revenue.counts.approved}
          currency={currency}
        />
        <StatusMetric
          status="in_progress"
          value={revenue.inProgressRevenue}
          count={revenue.counts.in_progress}
          currency={currency}
        />
        <StatusMetric
          status="completed"
          value={revenue.completedRevenue}
          count={revenue.counts.completed}
          currency={currency}
        />
      </section>

      <section
        className={cn(
          "mb-6 overflow-hidden rounded-xl border",
          decision.tone === "risk" && "border-destructive/30 bg-destructive/[0.035]",
          decision.tone === "watch" && "border-warning/40 bg-warning/[0.04]",
          decision.tone === "healthy" && "border-primary/25 bg-primary/[0.025]",
          decision.tone === "neutral" && "bg-card",
        )}
      >
        <div className="grid lg:grid-cols-[1.35fr_1fr]">
          <div className="p-5 sm:p-7">
            <div className="mb-5 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Gauge className="size-4" />
              Decision brief
            </div>
            <h2 className="max-w-2xl font-display text-2xl font-semibold leading-tight sm:text-3xl">
              {decision.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {decision.body}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {attentionProjects.length > 0 ? (
                <Button size="sm" onClick={() => setPortfolioFilter("attention")}>
                  Review {attentionProjects.length} flagged project
                  {attentionProjects.length === 1 ? "" : "s"}
                  <ArrowRight className="size-3.5" />
                </Button>
              ) : (
                <Button asChild size="sm">
                  <Link to="/calculator">
                    Create an estimate <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              )}
              <Button asChild size="sm" variant="outline">
                <Link to="/compare">Compare scenarios</Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 border-t bg-card/70 lg:border-l lg:border-t-0">
            <IntelligenceMetric
              label="Booked revenue"
              value={formatMoney(revenue.bookedRevenue, currency)}
              detail={`${revenueProjects.length} approved or delivered projects`}
            />
            <IntelligenceMetric
              label="Weighted margin"
              value={`${weightedMargin.toFixed(1)}%`}
              detail={`${(weightedMargin - targetMargin).toFixed(1)} pts vs target`}
              state={weightedMargin >= targetMargin ? "positive" : "negative"}
            />
            <IntelligenceMetric
              label="Net profit"
              value={formatMoney(netProfit, currency)}
              detail={`${formatMoney(totalCost, currency)} estimated cost`}
              state={netProfit >= 0 ? "positive" : "negative"}
            />
            <IntelligenceMetric
              label="Largest exposure"
              value={`${largestShare.toFixed(1)}%`}
              detail={sortedByValue[0]?.name ?? "No project exposure"}
              state={largestShare >= 50 ? "negative" : "neutral"}
            />
          </div>
        </div>
      </section>

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(260px,0.8fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between gap-4 border-b pb-4">
            <div>
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <LineChart className="size-4 text-primary" />
                Pipeline and margin movement
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Latest estimate per project, grouped by saved month
              </p>
            </div>
            {pipelineChange !== null && (
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-semibold",
                  pipelineChange >= 0 ? "text-foreground" : "text-destructive",
                )}
              >
                {pipelineChange >= 0 ? (
                  <ArrowUpRight className="size-3.5" />
                ) : (
                  <ArrowDownRight className="size-3.5" />
                )}
                {Math.abs(pipelineChange).toFixed(0)}% vs prior month
              </div>
            )}
          </CardHeader>
          <CardContent className="px-2 pb-3 pt-5 sm:px-5">
            {periodProjects.length === 0 ? (
              <EmptyChart />
            ) : (
              <div className="h-72 w-full" aria-label="Pipeline and margin chart">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    />
                    <YAxis
                      yAxisId="money"
                      axisLine={false}
                      tickLine={false}
                      width={62}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                      tickFormatter={(value) => compactMoney(Number(value), currency)}
                    />
                    <YAxis
                      yAxisId="margin"
                      orientation="right"
                      axisLine={false}
                      tickLine={false}
                      width={38}
                      domain={[0, 100]}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip content={<IntelligenceTooltip currency={currency} />} />
                    <ReferenceLine
                      yAxisId="margin"
                      y={targetMargin}
                      stroke="var(--warning)"
                      strokeDasharray="4 5"
                    />
                    <Bar
                      yAxisId="money"
                      dataKey="pipeline"
                      fill="var(--chart-3)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={44}
                    />
                    <Line
                      yAxisId="margin"
                      type="monotone"
                      dataKey="margin"
                      stroke="var(--primary)"
                      strokeWidth={2.5}
                      dot={{ fill: "var(--card)", stroke: "var(--primary)", strokeWidth: 2, r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-4 px-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-chart-3" /> Pipeline value
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-primary" /> Weighted margin
              </span>
              <span className="ml-auto">Target margin {targetMargin.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b pb-4">
            <CardTitle className="flex items-center justify-between font-display text-base">
              <span className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-warning" /> Risk queue
              </span>
              <Badge variant={attentionProjects.length ? "destructive" : "secondary"}>
                {attentionProjects.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {attentionProjects.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <CircleCheck className="mx-auto mb-3 size-6 text-primary" />
                <p className="text-sm font-medium">No pricing exceptions</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Every project in this period is at or above the margin target.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {attentionProjects
                  .sort((a, b) => a.marginPct - b.marginPct)
                  .slice(0, 5)
                  .map((project) => {
                    const risk = riskFor(project, targetMargin);
                    return (
                      <div key={project.id} className="px-4 py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{project.name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{risk.reason}</p>
                          </div>
                          <RiskBadge level={risk.level} label={risk.label} />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {formatMoney(project.price, currency)} quote
                          </span>
                          <span className="font-semibold tabular-nums">
                            {project.marginPct.toFixed(1)}% margin
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="mb-6 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <Signal
          icon={<Target className="size-4" />}
          label="Average quote"
          value={formatMoney(averageQuote, currency)}
          note="Current period"
        />
        <Signal
          icon={<BriefcaseBusiness className="size-4" />}
          label="Quoted projects"
          value={periodProjects.length.toLocaleString()}
          note={`${latestProjects.length} across all time`}
        />
        <Signal
          icon={<Clock3 className="size-4" />}
          label="Scoped hours"
          value={Math.round(
            periodProjects.reduce((sum, project) => sum + project.hours, 0),
          ).toLocaleString()}
          note="Latest estimates"
        />
        <Signal
          icon={<AlertTriangle className="size-4" />}
          label="Margin at risk"
          value={formatMoney(
            attentionProjects.reduce((sum, project) => sum + project.price, 0),
            currency,
          )}
          note={`${attentionProjects.length} flagged projects`}
        />
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div>
            <CardTitle className="font-display text-base">Project portfolio</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Latest estimate per project, ordered by commercial risk
            </p>
          </div>
          <div className="flex rounded-lg border bg-background p-1">
            {(["all", "attention"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setPortfolioFilter(filter)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  portfolioFilter === filter
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={portfolioFilter === filter}
              >
                {filter === "all"
                  ? `All ${periodProjects.length}`
                  : `Needs attention ${attentionProjects.length}`}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredPortfolio.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <CircleCheck className="mx-auto mb-3 size-6 text-primary" />
              <p className="text-sm font-medium">
                {portfolioFilter === "attention"
                  ? "No projects need attention."
                  : "No estimates fall inside this period."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {portfolioFilter === "attention"
                  ? "The selected portfolio meets its pricing guardrails."
                  : "Choose a longer period or save a new estimate."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/45 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium" scope="col">
                      Project
                    </th>
                    <th className="px-4 py-3 font-medium" scope="col">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right font-medium" scope="col">
                      Quote
                    </th>
                    <th className="px-4 py-3 text-right font-medium" scope="col">
                      Cost
                    </th>
                    <th className="px-4 py-3 text-right font-medium" scope="col">
                      Net profit
                    </th>
                    <th className="px-4 py-3 text-right font-medium" scope="col">
                      Margin
                    </th>
                    <th className="px-4 py-3 font-medium" scope="col">
                      Risk
                    </th>
                    <th className="px-4 py-3 text-right font-medium" scope="col">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredPortfolio.map((project) => {
                    const risk = riskFor(project, targetMargin);
                    return (
                      <tr key={project.id} className="bg-card hover:bg-muted/20">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                "h-7 w-1 rounded-full",
                                risk.level === "critical" && "bg-destructive",
                                risk.level === "high" && "bg-destructive/70",
                                risk.level === "medium" && "bg-warning",
                                risk.level === "healthy" && "bg-primary/35",
                              )}
                            />
                            <div className="min-w-0">
                              {project.projectId ? (
                                <Link
                                  to="/projects/$id"
                                  params={{ id: project.projectId }}
                                  className="font-medium hover:underline"
                                >
                                  {project.name}
                                </Link>
                              ) : (
                                <p className="font-medium">{project.name}</p>
                              )}
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {project.client} · {project.label} v{project.version}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <ProjectStatusBadge status={project.status} />
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium tabular-nums">
                          {formatMoney(project.price, currency)}
                        </td>
                        <td className="px-4 py-3.5 text-right text-muted-foreground tabular-nums">
                          {formatMoney(project.totalCost, currency)}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3.5 text-right font-medium tabular-nums",
                            project.netProfit < 0 && "text-destructive",
                          )}
                        >
                          {formatMoney(project.netProfit, currency)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold tabular-nums">
                          {project.marginPct.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3.5">
                          <RiskBadge level={risk.level} label={risk.label} />
                        </td>
                        <td className="px-4 py-3.5 text-right text-xs text-muted-foreground">
                          {new Date(project.createdAt).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "2-digit",
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function IntelligenceMetric({
  label,
  value,
  detail,
  state = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  state?: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="min-w-0 border-b border-r p-4 last:border-b-0 even:border-r-0 lg:p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1.5 truncate font-display text-xl font-semibold tabular-nums",
          state === "negative" && "text-destructive",
          state === "positive" && "text-primary",
        )}
      >
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function StatusMetric({
  status,
  value,
  count,
  currency,
}: {
  status: ProjectStatus;
  value: number;
  count: number;
  currency: string;
}) {
  return (
    <div className="bg-card p-4">
      <ProjectStatusBadge status={status} />
      <p className="mt-3 font-display text-lg font-semibold tabular-nums">
        {formatMoney(value, currency)}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {count} project{count === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function Signal({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-2 font-display text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>
    </div>
  );
}

function RiskBadge({
  level,
  label,
}: {
  level: "critical" | "high" | "medium" | "healthy";
  label: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap text-[10px]",
        (level === "critical" || level === "high") &&
          "border-destructive/30 bg-destructive/10 text-destructive",
        level === "medium" && "border-warning/40 bg-warning/10 text-warning",
        level === "healthy" && "border-border bg-muted/50 text-foreground",
      )}
    >
      {label}
    </Badge>
  );
}

function IntelligenceTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number; payload?: TrendPoint }>;
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-medium">{label}</p>
      <p className="text-muted-foreground">
        Pipeline{" "}
        <span className="ml-2 font-semibold text-foreground">
          {formatMoney(point?.pipeline ?? 0, currency)}
        </span>
      </p>
      <p className="mt-1 text-muted-foreground">
        Margin{" "}
        <span className="ml-2 font-semibold text-foreground">
          {(point?.margin ?? 0).toFixed(1)}%
        </span>
      </p>
      <p className="mt-1 text-muted-foreground">
        Projects <span className="ml-2 font-semibold text-foreground">{point?.projects ?? 0}</span>
      </p>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="grid h-72 place-items-center rounded-lg bg-muted/25 text-center">
      <div>
        <LineChart className="mx-auto mb-3 size-6 text-muted-foreground" />
        <p className="text-sm font-medium">No estimates in this period</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose a longer period or save a new estimate.
        </p>
      </div>
    </div>
  );
}

function BusinessIntelligenceLoading() {
  return (
    <div className="space-y-6" aria-label="Loading business intelligence">
      <div className="h-16 animate-pulse rounded-lg bg-muted" />
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-80 animate-pulse rounded-xl bg-muted lg:col-span-2" />
        <div className="h-80 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}
