import * as React from "react";
import {
  ShieldCheck,
  TrendingUp,
  Clock,
  Calendar,
  Layers,
  Users,
  Server,
  Building2,
  Zap,
  Coffee,
  Wifi,
  Sparkles,
  DollarSign,
  Award,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatMoney,
  monthlyOverheadAmount,
  type CalculationInputs,
  type CalculationResults,
  type OverheadRecord,
  HOURS_PER_DAY,
  HOURS_PER_WEEK,
} from "@/lib/pricing";
import type { TeamMemberRate } from "./AllocationRow";
import { ROLE_GROUP_INFO, type RoleGroup } from "./qce/types";

function getRoleGroupForEmployee(emp: { job_title?: string | null; department?: string | null }): RoleGroup {
  const title = (emp.job_title || "").toLowerCase();
  const dept = (emp.department || "").toLowerCase();
  if (title.includes("design") || dept.includes("design")) return "design";
  if (title.includes("project manager") || title.includes("qa") || title.includes("quality")) return "pm_qa";
  if (title.includes("director") || title.includes("sales") || dept.includes("sales") || dept.includes("management")) {
    return "leadership";
  }
  return "dev";
}

interface DetailedBreakdownViewProps {
  inputs: CalculationInputs;
  results: CalculationResults;
  currency: string;
  employees: TeamMemberRate[];
  overheads?: OverheadRecord[] | undefined;
}

export const DetailedBreakdownView = React.memo(function DetailedBreakdownView({
  inputs,
  results,
  currency,
  employees,
  overheads = [],
}: DetailedBreakdownViewProps) {
  // 1. Department / Squad breakdown
  const squadStats = React.useMemo(() => {
    const stats: Record<
      RoleGroup,
      { hours: number; cost: number; members: Set<string>; count: number }
    > = {
      dev: { hours: 0, cost: 0, members: new Set(), count: 0 },
      design: { hours: 0, cost: 0, members: new Set(), count: 0 },
      pm_qa: { hours: 0, cost: 0, members: new Set(), count: 0 },
      leadership: { hours: 0, cost: 0, members: new Set(), count: 0 },
    };

    inputs.phases.forEach((p) => {
      p.allocations.forEach((a) => {
        const emp = a.employeeId ? employees.find((e) => e.id === a.employeeId) : null;
        let group: RoleGroup = "dev";
        if (emp) {
          group = getRoleGroupForEmployee(emp);
          stats[group].members.add(emp.name);
        } else {
          // Infer from label
          const l = (a.label || "").toLowerCase();
          if (l.includes("design") || l.includes("ui") || l.includes("ux")) group = "design";
          else if (l.includes("pm") || l.includes("qa") || l.includes("test")) group = "pm_qa";
          else if (l.includes("sales") || l.includes("lead") || l.includes("dir")) group = "leadership";
          stats[group].members.add(a.label || "Specialist");
        }
        const h = Number(a.hours) || 0;
        const c = h * (Number(a.hourlyCost) || 0);
        stats[group].hours += h;
        stats[group].cost += c;
        stats[group].count += 1;
      });
    });

    return stats;
  }, [inputs.phases, employees]);

  // Total labor cost from phases
  const totalLaborCost = results.laborCost || 1;
  const totalLaborHours = results.totalHours || 1;

  // 2. Multi-Unit Rate Cards
  const rateCards = [
    {
      unit: "Hourly Rate",
      hours: 1,
      cost: results.costPerHour,
      price: results.pricePerHour,
      profit: results.pricePerHour - results.costPerHour,
      icon: "⏱️",
    },
    {
      unit: "Daily Rate (8 hrs)",
      hours: 8,
      cost: results.costPerDay,
      price: results.pricePerDay,
      profit: results.pricePerDay - results.costPerDay,
      icon: "📅",
    },
    {
      unit: "Weekly Rate (40 hrs)",
      hours: 40,
      cost: results.costPerWeek,
      price: results.pricePerWeek,
      profit: results.pricePerWeek - results.costPerWeek,
      icon: "📆",
    },
    {
      unit: "Monthly Sprint (160 hrs)",
      hours: 160,
      cost: results.costPerMonth,
      price: results.pricePerMonth,
      profit: results.pricePerMonth - results.costPerMonth,
      icon: "🗓️",
    },
  ];

  // 3. Absorbed Overheads reference
  const defaultOverheads = [
    { name: "Office Rent (Gulshan / PECHS)", monthly: 143000, icon: Building2, desc: "Prime commercial office space" },
    { name: "Electricity (K-Electric)", monthly: 103420, icon: Zap, desc: "Commercial grid + UPS & power backup" },
    { name: "Peon / Office Boy / Tea & Refreshments", monthly: 32000, icon: Coffee, desc: "Hospitality & office pantry" },
    { name: "Microsoft Office 365 Enterprise", monthly: 26233, icon: ShieldCheck, desc: "$1,124 / year company license" },
    { name: "Dedicated Cloud Server & Infrastructure", monthly: 17500, icon: Server, desc: "$748 / year enterprise staging server" },
    { name: "High-Speed Fiber Internet & Backup", monthly: 18000, icon: Wifi, desc: "Dual ISP dedicated leased line" },
    { name: "General Maintenance & Office Supplies", monthly: 14776, icon: Layers, desc: "Stationery, maintenance, hardware" },
    { name: "Security Guard & Surveillance", monthly: 9000, icon: ShieldCheck, desc: "24/7 building security" },
  ];

  const displayOverheads = overheads.length > 0
    ? overheads.map((o) => ({
        name: o.name,
        monthly: monthlyOverheadAmount(o),
        icon: Building2,
        desc: o.category || "Absorbed Operating Expense",
      }))
    : defaultOverheads;

  const totalMonthlyOverhead = displayOverheads.reduce((sum, o) => sum + o.monthly, 0);

  return (
    <div className="space-y-6">
      {/* 1. Executive Snapshot KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* Client Quote */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium">
            <span>Client Quote Price</span>
            <DollarSign className="size-3.5 text-primary" />
          </div>
          <div className="mt-1">
            <span className="font-display text-lg sm:text-xl font-bold text-foreground tabular">
              {formatMoney(results.price, currency)}
            </span>
            <span className="block text-[10px] text-muted-foreground font-mono mt-0.5">
              {formatMoney(results.pricePerHour, currency)}/hr
            </span>
          </div>
        </div>

        {/* Loaded Delivery Cost */}
        <div className="rounded-xl border bg-card p-3 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium">
            <span>Loaded Delivery Cost</span>
            <ShieldCheck className="size-3.5 text-blue-500" />
          </div>
          <div className="mt-1">
            <span className="font-display text-lg sm:text-xl font-bold text-foreground tabular">
              {formatMoney(results.totalCost, currency)}
            </span>
            <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
              ✓ 100% overheads loaded
            </span>
          </div>
        </div>

        {/* Gross Profit & Margin */}
        <div className="rounded-xl border bg-card p-3 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium">
            <span>Gross Profit</span>
            <TrendingUp className="size-3.5 text-emerald-500" />
          </div>
          <div className="mt-1">
            <span className="font-display text-lg sm:text-xl font-bold text-foreground tabular">
              {formatMoney(results.profit, currency)}
            </span>
            <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold font-mono mt-0.5">
              {results.marginPct.toFixed(1)}% Gross Margin
            </span>
          </div>
        </div>

        {/* Sales Commission (Ayesha Badar 5%) */}
        <div className="rounded-xl border bg-card p-3 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium">
            <span>Sales Commission</span>
            <Award className="size-3.5 text-amber-500" />
          </div>
          <div className="mt-1">
            <span className="font-display text-lg sm:text-xl font-bold text-foreground tabular">
              {formatMoney(results.salesCommissionAmount, currency)}
            </span>
            <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-mono mt-0.5">
              {results.salesCommissionPct}% (Ayesha Badar)
            </span>
          </div>
        </div>

        {/* Net Profit After Commission */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-[11px] font-medium">
            <span>Company Net Profit</span>
            <Sparkles className="size-3.5 text-emerald-600" />
          </div>
          <div className="mt-1">
            <span className="font-display text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-300 tabular">
              {formatMoney(results.netProfitAfterCommission, currency)}
            </span>
            <span className="block text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-mono mt-0.5">
              After sales payout
            </span>
          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-xl border bg-card p-3 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium">
            <span>Delivery Timeline</span>
            <Calendar className="size-3.5 text-indigo-500" />
          </div>
          <div className="mt-1">
            <span className="font-display text-lg sm:text-xl font-bold text-foreground tabular">
              {results.totalHours} hrs
            </span>
            <span className="block text-[10px] text-muted-foreground font-mono mt-0.5">
              ~{results.totalDays}d / {results.totalWeeks}w / {results.totalMonths}mo
            </span>
          </div>
        </div>
      </div>

      {/* 2. Multi-Unit Rate Card Comparison Table */}
      <Card className="shadow-xs border">
        <CardHeader className="pb-2.5">
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-sm sm:text-base flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <span>Multi-Unit Rate Card & Quotation Analysis</span>
            </CardTitle>
            <Badge variant="outline" className="text-[11px]">
              Based on 8h/day · 40h/wk · 160h/mo
            </Badge>
          </div>
          <CardDescription>
            Seamlessly quote by the hour, day, week, month, or fixed total price with consistent margin discipline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground">
                  <th className="py-2 px-3 font-semibold">Billing Unit</th>
                  <th className="py-2 px-3 font-semibold text-right">Internal Delivery Cost</th>
                  <th className="py-2 px-3 font-semibold text-right">Quoted Client Price</th>
                  <th className="py-2 px-3 font-semibold text-right">Gross Profit</th>
                  <th className="py-2 px-3 font-semibold text-right">Sales Commission (5%)</th>
                  <th className="py-2 px-3 font-semibold text-right">Net Company Return</th>
                  <th className="py-2 px-3 font-semibold text-center">Effective Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rateCards.map((rc) => {
                  const comm = rc.price * (results.salesCommissionPct / 100);
                  const net = rc.profit - comm;
                  const margin = rc.price > 0 ? (rc.profit / rc.price) * 100 : 0;
                  return (
                    <tr key={rc.unit} className="hover:bg-muted/30 transition">
                      <td className="py-2.5 px-3 font-medium flex items-center gap-2">
                        <span>{rc.icon}</span>
                        <span>{rc.unit}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular text-muted-foreground">
                        {formatMoney(rc.cost, currency)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular font-bold text-foreground">
                        {formatMoney(rc.price, currency)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular text-emerald-600 dark:text-emerald-400 font-semibold">
                        +{formatMoney(rc.profit, currency)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular text-amber-600 dark:text-amber-400">
                        -{formatMoney(comm, currency)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular font-bold text-emerald-700 dark:text-emerald-300">
                        {formatMoney(net, currency)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {margin.toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {/* Total Scope Row */}
                <tr className="bg-primary/5 font-bold border-t-2 border-primary/30">
                  <td className="py-3 px-3 flex items-center gap-2 text-foreground font-semibold">
                    <span>🏆</span>
                    <span>Total Project Contract</span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular text-muted-foreground">
                    {formatMoney(results.totalCost, currency)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular text-primary text-sm">
                    {formatMoney(results.price, currency)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular text-emerald-600 dark:text-emerald-400">
                    +{formatMoney(results.profit, currency)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular text-amber-600 dark:text-amber-400">
                    -{formatMoney(results.salesCommissionAmount, currency)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular text-emerald-700 dark:text-emerald-300 text-sm">
                    {formatMoney(results.netProfitAfterCommission, currency)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <Badge className="font-mono text-xs">
                      {results.marginPct.toFixed(1)}%
                    </Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 3. Department & Squad Allocation Matrix */}
      <Card className="shadow-xs border">
        <CardHeader className="pb-2.5">
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-sm sm:text-base flex items-center gap-2">
              <Users className="size-4 text-primary" />
              <span>Department & Squad Resource Distribution</span>
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {results.totalHours} total engineering hours
            </span>
          </div>
          <CardDescription>
            Allocation of work hours and direct loaded costs across development, design, quality assurance, and project management.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(["dev", "design", "pm_qa", "leadership"] as RoleGroup[]).map((grp) => {
              const info = ROLE_GROUP_INFO[grp];
              const st = squadStats[grp];
              const hoursShare = totalLaborHours > 0 ? (st.hours / totalLaborHours) * 100 : 0;
              const costShare = totalLaborCost > 0 ? (st.cost / totalLaborCost) * 100 : 0;
              const avgRate = st.hours > 0 ? st.cost / st.hours : 0;
              const memberList = Array.from(st.members);

              return (
                <div
                  key={grp}
                  className="rounded-xl border p-3.5 bg-card/60 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold flex items-center gap-1.5">
                        <span>{info.icon}</span>
                        <span>{info.label}</span>
                      </span>
                      <Badge variant="outline" className={`text-[10px] ${info.badgeClass}`}>
                        {hoursShare.toFixed(0)}% hours
                      </Badge>
                    </div>

                    <div className="pt-2 flex items-baseline justify-between">
                      <span className="font-display text-lg font-bold text-foreground tabular">
                        {st.hours} hrs
                      </span>
                      <span className="text-xs font-semibold text-primary tabular font-mono">
                        {formatMoney(st.cost, currency)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          grp === "dev"
                            ? "bg-blue-500"
                            : grp === "design"
                            ? "bg-purple-500"
                            : grp === "pm_qa"
                            ? "bg-emerald-500"
                            : "bg-amber-500"
                        }`}
                        style={{ width: `${Math.min(hoursShare, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                      <span>Avg Rate: {formatMoney(avgRate, currency)}/hr</span>
                      <span>{costShare.toFixed(0)}% cost</span>
                    </div>
                  </div>

                  {/* Assigned Team Members */}
                  <div className="border-t pt-2">
                    <span className="text-[10px] text-muted-foreground block mb-1">
                      Assigned Members ({memberList.length}):
                    </span>
                    {memberList.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground/60 italic">None allocated</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {memberList.map((m) => (
                          <span
                            key={m}
                            className="rounded-md bg-secondary/80 px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 4. Phase-by-Phase Financial & Timeline Matrix */}
      <Card className="shadow-xs border">
        <CardHeader className="pb-2.5">
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-sm sm:text-base flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <span>Phase-by-Phase Financial & Timeline Matrix</span>
            </CardTitle>
            <Badge variant="secondary" className="font-mono text-xs">
              {inputs.phases.length} Phases Defined
            </Badge>
          </div>
          <CardDescription>
            Detailed breakdown of each project milestone with assigned specialists, duration equivalents, and loaded labor cost.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inputs.phases.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
              No phases defined yet in the project.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground">
                    <th className="py-2 px-3 font-semibold">Phase / Milestone</th>
                    <th className="py-2 px-3 font-semibold">Assigned Roles & Team</th>
                    <th className="py-2 px-3 font-semibold text-right">Hours</th>
                    <th className="py-2 px-3 font-semibold text-right">Duration (Days)</th>
                    <th className="py-2 px-3 font-semibold text-right">Duration (Weeks)</th>
                    <th className="py-2 px-3 font-semibold text-right">Loaded Cost</th>
                    <th className="py-2 px-3 font-semibold text-right">Effective Rate</th>
                    <th className="py-2 px-3 font-semibold text-center">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {inputs.phases.map((ph, idx) => {
                    const phaseHours = ph.allocations.reduce(
                      (s, a) => s + (Number(a.hours) || 0),
                      0,
                    );
                    const phaseCost = ph.allocations.reduce(
                      (s, a) => s + (Number(a.hours) || 0) * (Number(a.hourlyCost) || 0),
                      0,
                    );
                    const days = Math.round((phaseHours / HOURS_PER_DAY) * 10) / 10;
                    const weeks = Math.round((phaseHours / HOURS_PER_WEEK) * 10) / 10;
                    const effectiveRate = phaseHours > 0 ? phaseCost / phaseHours : 0;
                    const share = totalLaborCost > 0 ? (phaseCost / totalLaborCost) * 100 : 0;

                    const rolesSummary = ph.allocations.map((a) => {
                      const emp = a.employeeId ? employees.find((e) => e.id === a.employeeId) : null;
                      return emp?.name ?? a.label ?? "Specialist";
                    });

                    return (
                      <tr key={ph.id} className="hover:bg-muted/30 transition">
                        <td className="py-2.5 px-3 font-medium text-foreground">
                          <span className="mr-1 text-muted-foreground font-mono">
                            {idx + 1}.
                          </span>
                          {ph.name}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {rolesSummary.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {rolesSummary.map((r, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                                  {r}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="italic text-muted-foreground/60">No roles</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular font-medium">
                          {phaseHours}h
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular text-muted-foreground">
                          ~{days}d
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular text-muted-foreground">
                          ~{weeks}w
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular font-semibold text-primary">
                          {formatMoney(phaseCost, currency)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular text-muted-foreground">
                          {formatMoney(effectiveRate, currency)}/hr
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            {share.toFixed(0)}%
                          </Badge>
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

      {/* 5. Transparent Overhead Absorption Statement */}
      <Card className="shadow-xs border border-emerald-500/30 bg-emerald-500/5">
        <CardHeader className="pb-2.5">
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-sm sm:text-base flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span>Corporate Overhead Absorption Statement</span>
            </CardTitle>
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs">
              {formatMoney(totalMonthlyOverhead, currency)} / mo absorbed
            </Badge>
          </div>
          <CardDescription className="text-emerald-700/80 dark:text-emerald-400/80">
            Alisons Technology runs on fully-loaded rate discipline. Fixed facility, software, power, and infrastructure expenses are automatically incorporated into every billable delivery hour.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {displayOverheads.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.name}
                  className="rounded-lg border border-emerald-500/20 bg-background/80 p-2.5 shadow-2xs space-y-1"
                >
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                    <Icon className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="font-mono font-bold text-xs text-emerald-700 dark:text-emerald-300 tabular">
                      {formatMoney(item.monthly, currency)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">/ month</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/80 line-clamp-1">{item.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg bg-background/90 border p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <div className="space-y-0.5">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                Zero Overhead Leakage Guarantee
              </span>
              <p className="text-[11px] text-muted-foreground">
                Whether a project runs for 2 days, 3 weeks, or 6 months, electricity, cloud server fees, Office 365 seats, and executive payroll are mathematically recovered.
              </p>
            </div>
            <Badge variant="outline" className="font-mono text-xs px-2.5 py-1 shrink-0 border-emerald-500/40">
              14 Active Team Members Absorbing
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 6. Financial Waterfall / Cost-to-Price Bridge */}
      <Card className="shadow-xs border">
        <CardHeader className="pb-2.5">
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-sm sm:text-base flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              <span>Financial Waterfall & Cost-to-Price Bridge</span>
            </CardTitle>
            <span className="text-xs text-muted-foreground font-mono">
              Delivery Cost → Margin → Quote → Net Profit
            </span>
          </div>
          <CardDescription>
            Transparent accounting walk from direct engineering labor through risk contingency, gross margin, sales commission, and net company profit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-xs">
            {/* Direct Labor */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
              <div className="flex items-center gap-2">
                <span className="rounded bg-blue-500/10 text-blue-600 px-1.5 py-0.5 font-mono text-[11px] font-bold">
                  1
                </span>
                <span className="font-medium text-foreground">Direct Phase Engineering Labor</span>
                <span className="text-[11px] text-muted-foreground">({results.totalHours} team hours)</span>
              </div>
              <span className="font-mono tabular font-semibold text-foreground">
                +{formatMoney(results.laborCost, currency)}
              </span>
            </div>

            {/* Support */}
            {results.supportCost > 0 && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-purple-500/10 text-purple-600 px-1.5 py-0.5 font-mono text-[11px] font-bold">
                    2
                  </span>
                  <span className="font-medium text-foreground">Post-Launch Support & Maintenance</span>
                  <span className="text-[11px] text-muted-foreground">
                    ({inputs.support.months} mos @ {inputs.support.hoursPerMonth}h/mo)
                  </span>
                </div>
                <span className="font-mono tabular font-semibold text-foreground">
                  +{formatMoney(results.supportCost, currency)}
                </span>
              </div>
            )}

            {/* Additional Scope */}
            {results.additionalCost > 0 && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-indigo-500/10 text-indigo-600 px-1.5 py-0.5 font-mono text-[11px] font-bold">
                    3
                  </span>
                  <span className="font-medium text-foreground">Additional Scope Deliverables & Assets</span>
                </div>
                <span className="font-mono tabular font-semibold text-foreground">
                  +{formatMoney(results.additionalCost, currency)}
                </span>
              </div>
            )}

            {/* Tech */}
            {results.technologyCost > 0 && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-sky-500/10 text-sky-600 px-1.5 py-0.5 font-mono text-[11px] font-bold">
                    4
                  </span>
                  <span className="font-medium text-foreground">Technology Licenses, Cloud & APIs</span>
                </div>
                <span className="font-mono tabular font-semibold text-foreground">
                  +{formatMoney(results.technologyCost, currency)}
                </span>
              </div>
            )}

            {/* Contingency */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
              <div className="flex items-center gap-2">
                <span className="rounded bg-amber-500/10 text-amber-600 px-1.5 py-0.5 font-mono text-[11px] font-bold">
                  5
                </span>
                <span className="font-medium text-foreground">Project Risk & Contingency Buffer</span>
                <span className="text-[11px] text-muted-foreground">({inputs.contingencyPct}%)</span>
              </div>
              <span className="font-mono tabular font-semibold text-amber-600 dark:text-amber-400">
                +{formatMoney(results.contingencyAmount, currency)}
              </span>
            </div>

            {/* Total Cost Line */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card font-semibold text-sm">
              <span className="text-foreground">Total Loaded Delivery Cost</span>
              <span className="font-mono tabular text-foreground">
                = {formatMoney(results.totalCost, currency)}
              </span>
            </div>

            {/* Gross Profit Margin */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <div className="flex items-center gap-2">
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[11px] font-bold">
                  6
                </span>
                <span className="font-medium">Target Company Margin ({results.marginPct.toFixed(1)}%)</span>
              </div>
              <span className="font-mono tabular font-bold">
                +{formatMoney(results.profit, currency)}
              </span>
            </div>

            {/* Client Quote Price Line */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-primary text-primary-foreground font-bold text-base shadow-sm">
              <span>Final Quoted Client Price</span>
              <span className="font-mono tabular text-lg">
                {formatMoney(results.price, currency)}
              </span>
            </div>

            {/* Sales Commission */}
            {results.salesCommissionAmount > 0 && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[11px] font-bold">
                    7
                  </span>
                  <span className="font-medium">
                    Sales Commission Payout ({results.salesCommissionPct}% to Ayesha Badar)
                  </span>
                </div>
                <span className="font-mono tabular font-semibold">
                  -{formatMoney(results.salesCommissionAmount, currency)}
                </span>
              </div>
            )}

            {/* Company Net Take-Home */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 font-bold text-base">
              <span>Net Company Profit After Commission</span>
              <span className="font-mono tabular text-lg text-emerald-700 dark:text-emerald-300">
                {formatMoney(results.netProfitAfterCommission, currency)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
