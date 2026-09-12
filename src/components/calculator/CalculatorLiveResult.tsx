import * as React from "react";
import { AlertTriangle, Clock, Calendar, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, type CalculationResults, type ValidationIssue, type TimeUnit } from "@/lib/pricing";

interface CalculatorLiveResultProps {
  currency: string;
  results: CalculationResults;
  contingencyPct: number;
  issues: ValidationIssue[];
  saving: boolean;
  blocking: boolean;
  onSave: () => void;
}

const Row = React.memo(function Row({
  label,
  value,
  strong,
  subtext,
}: {
  label: string;
  value: string;
  strong?: boolean;
  subtext?: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs sm:text-sm">
      <div className="flex flex-col">
        <span className="text-muted-foreground">{label}</span>
        {subtext && <span className="text-[11px] text-muted-foreground/75">{subtext}</span>}
      </div>
      <span className={`tabular ${strong ? "font-semibold text-foreground" : ""}`}>{value}</span>
    </div>
  );
});

export const CalculatorLiveResult = React.memo(function CalculatorLiveResult({
  currency,
  results,
  contingencyPct,
  issues,
  saving,
  blocking,
  onSave,
}: CalculatorLiveResultProps) {
  const [selectedUnit, setSelectedUnit] = React.useState<"total" | TimeUnit>("total");

  // Get displayed price & cost based on active unit
  const displayMetrics = React.useMemo(() => {
    switch (selectedUnit) {
      case "hours":
        return {
          title: "Hourly Rate Quote",
          price: results.pricePerHour,
          cost: results.costPerHour,
          unitLabel: "/ hour",
        };
      case "days":
        return {
          title: "Daily Rate Quote (8h)",
          price: results.pricePerDay,
          cost: results.costPerDay,
          unitLabel: "/ day",
        };
      case "weeks":
        return {
          title: "Weekly Rate Quote (40h)",
          price: results.pricePerWeek,
          cost: results.costPerWeek,
          unitLabel: "/ week",
        };
      case "months":
        return {
          title: "Monthly Rate Quote (160h)",
          price: results.pricePerMonth,
          cost: results.costPerMonth,
          unitLabel: "/ month",
        };
      case "total":
      default:
        return {
          title: "Total Project Quote",
          price: results.price,
          cost: results.totalCost,
          unitLabel: "total",
        };
    }
  }, [selectedUnit, results]);

  return (
    <Card className="lg:sticky lg:top-6 shadow-sm border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-base">Cost & Price Summary</CardTitle>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="size-3" /> Overheads Loaded
          </span>
        </div>
        <CardDescription>
          Absorbs rent, electricity, server, O365, and director payroll into every quote.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {/* Unit Selector: Total / Hour / Day / Week / Month */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">View Analysis By:</span>
            <span>{results.totalHours} total hours</span>
          </div>
          <div className="grid grid-cols-5 gap-1 rounded-lg bg-secondary/80 p-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedUnit("total")}
              className={`rounded px-1.5 py-1 text-center font-medium transition ${
                selectedUnit === "total"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Total
            </button>
            <button
              type="button"
              onClick={() => setSelectedUnit("hours")}
              className={`rounded px-1.5 py-1 text-center font-medium transition ${
                selectedUnit === "hours"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Hour
            </button>
            <button
              type="button"
              onClick={() => setSelectedUnit("days")}
              className={`rounded px-1.5 py-1 text-center font-medium transition ${
                selectedUnit === "days"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setSelectedUnit("weeks")}
              className={`rounded px-1.5 py-1 text-center font-medium transition ${
                selectedUnit === "weeks"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setSelectedUnit("months")}
              className={`rounded px-1.5 py-1 text-center font-medium transition ${
                selectedUnit === "months"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Month
            </button>
          </div>
        </div>

        {/* Highlighted Price Card */}
        <div className="rounded-xl bg-primary p-4 text-primary-foreground shadow-sm">
          <div className="flex items-center justify-between opacity-85 text-xs">
            <span className="uppercase tracking-wider">{displayMetrics.title}</span>
            {selectedUnit !== "total" && (
              <span className="font-mono">{displayMetrics.unitLabel}</span>
            )}
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <p className="font-display text-2xl sm:text-3xl font-bold tabular">
              {formatMoney(displayMetrics.price, currency)}
            </p>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs opacity-80 border-t border-primary-foreground/20 pt-2">
            <span>Base Cost: {formatMoney(displayMetrics.cost, currency)}</span>
            <span>Margin: {results.marginPct.toFixed(1)}%</span>
          </div>
        </div>

        {/* Quick Rate Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs border rounded-lg p-2.5 bg-muted/30">
          <div>
            <span className="text-muted-foreground block text-[11px]">Per Day (8h):</span>
            <span className="font-semibold">{formatMoney(results.pricePerDay, currency)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Per Week (40h):</span>
            <span className="font-semibold">{formatMoney(results.pricePerWeek, currency)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Per Month (160h):</span>
            <span className="font-semibold">{formatMoney(results.pricePerMonth, currency)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Blended Rate:</span>
            <span className="font-semibold">{formatMoney(results.blendedRate, currency)} / hr</span>
          </div>
        </div>

        {/* Cost Rows Breakdown */}
        <div className="space-y-1.5 pt-1">
          <Row
            label="Delivery Team Hours"
            value={`${Math.round(results.totalHours)} hrs (~${results.totalDays}d / ${results.totalWeeks}w / ${results.totalMonths}mo)`}
          />
          <Row label="Engineering Labor" value={formatMoney(results.laborCost, currency)} />
          {results.supportCost > 0 && (
            <Row label="Ongoing Support" value={formatMoney(results.supportCost, currency)} />
          )}
          {results.additionalCost > 0 && (
            <Row label="Additional Scope" value={formatMoney(results.additionalCost, currency)} />
          )}
          {results.technologyCost > 0 && (
            <Row label="Tech & Infrastructure" value={formatMoney(results.technologyCost, currency)} />
          )}
          <Row
            label={`Contingency Buffer (${contingencyPct}%)`}
            value={formatMoney(results.contingencyAmount, currency)}
          />

          <div className="border-t pt-2 space-y-1.5">
            <Row label="Total Development Cost" value={formatMoney(results.totalCost, currency)} strong />
            <Row label="Gross Profit" value={formatMoney(results.profit, currency)} />

            {/* Sales Commission for Ayesha */}
            {results.salesCommissionPct > 0 && (
              <>
                <Row
                  label={`Sales Commission (${results.salesCommissionPct}%)`}
                  subtext="Payable to Sales (Ayesha)"
                  value={formatMoney(results.salesCommissionAmount, currency)}
                />
                <Row
                  label="Net Profit After Commission"
                  value={formatMoney(results.netProfitAfterCommission, currency)}
                  strong
                />
              </>
            )}
          </div>
        </div>

        {/* Validation Issues */}
        {issues.length > 0 && (
          <ul className="space-y-1 pt-1 border-t">
            {issues.map((i, idx) => (
              <li
                key={idx}
                className={`flex gap-2 text-xs ${
                  i.level === "error" ? "text-destructive font-medium" : "text-amber-600 dark:text-amber-400"
                }`}
              >
                <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                {i.message}
              </li>
            ))}
          </ul>
        )}

        <Button
          className="w-full mt-2 font-medium"
          size="lg"
          disabled={saving || blocking}
          onClick={onSave}
        >
          {saving ? "Saving Estimate..." : "Save Project Estimate"}
        </Button>
      </CardContent>
    </Card>
  );
});
