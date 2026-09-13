// ─── CostSummaryPanel ─────────────────────────────────────────────────────────
// Hour/Day/Week/Month rate cards + total project quote banner + apply button
import * as React from "react";
import { Clock, Calendar, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/pricing";

interface CostSummaryPanelProps {
  currency: string;
  marginPct: number;
  salesCommissionPct: number;
  durationValue: number;
  durationUnit: string;
  totalHours: number;
  pricePerHour: number;
  pricePerDay: number;
  pricePerWeek: number;
  pricePerMonth: number;
  costPerHour: number;
  costPerDay: number;
  costPerWeek: number;
  costPerMonth: number;
  price: number;
  totalCost: number;
  commission: number;
  netProfit: number;
  onApply: () => void;
}

const RateCard = ({
  icon,
  label,
  price,
  cost,
  currency,
}: {
  icon: React.ReactNode;
  label: string;
  price: number;
  cost: number;
  currency: string;
}) => (
  <div className="rounded-lg border bg-card p-3 shadow-2xs">
    <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
      {icon}
      <span>{label}</span>
    </div>
    <p className="text-lg font-bold font-display text-primary">{formatMoney(price, currency)}</p>
    <p className="text-[11px] text-muted-foreground mt-0.5">Cost: {formatMoney(cost, currency)}</p>
  </div>
);

export const CostSummaryPanel = React.memo(function CostSummaryPanel({
  currency,
  marginPct,
  salesCommissionPct,
  durationValue,
  durationUnit,
  totalHours,
  pricePerHour,
  pricePerDay,
  pricePerWeek,
  pricePerMonth,
  costPerHour,
  costPerDay,
  costPerWeek,
  costPerMonth,
  price,
  totalCost,
  commission,
  netProfit,
  onApply,
}: CostSummaryPanelProps) {
  return (
    <div className="rounded-xl border from-primary/5 via-card to-background p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h3 className="font-display font-semibold text-base">Cost &amp; Price Breakdown</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {Math.round(totalHours)} total project hours
        </span>
      </div>

      {/* Rate cards grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <RateCard
          icon={<Clock className="size-3.5" />}
          label="Per Hour Rate"
          price={pricePerHour}
          cost={costPerHour}
          currency={currency}
        />
        <RateCard
          icon={<Calendar className="size-3.5" />}
          label="Per Day (8 hrs)"
          price={pricePerDay}
          cost={costPerDay}
          currency={currency}
        />
        <RateCard
          icon={<Calendar className="size-3.5" />}
          label="Per Week (40 hrs)"
          price={pricePerWeek}
          cost={costPerWeek}
          currency={currency}
        />
        <RateCard
          icon={<Calendar className="size-3.5" />}
          label="Per Month (160 hrs)"
          price={pricePerMonth}
          cost={costPerMonth}
          currency={currency}
        />
      </div>

      {/* Total quote banner */}
      <div className="rounded-lg bg-primary text-primary-foreground p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-wider opacity-85">
            Total Project Quote ({durationValue} {durationUnit})
          </p>
          <p className="text-3xl font-bold font-display mt-0.5">{formatMoney(price, currency)}</p>
          <p className="text-xs opacity-80 mt-1">
            Delivery Cost: {formatMoney(totalCost, currency)} · Margin: {marginPct}%
          </p>
        </div>

        <div className="flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-t-0 sm:border-l border-primary-foreground/20 pt-2 sm:pt-0 sm:pl-4">
          <div className="text-right">
            <span className="text-xs opacity-85 block">
              Sales Commission ({salesCommissionPct}%):
            </span>
            <span className="font-semibold text-sm">{formatMoney(commission, currency)}</span>
          </div>
          <div className="text-right mt-1">
            <span className="text-xs opacity-85 block">Net Company Profit:</span>
            <span className="font-semibold text-sm">{formatMoney(netProfit, currency)}</span>
          </div>
        </div>
      </div>

      {/* Apply action */}
      <div className="flex justify-end pt-1">
        <Button size="lg" onClick={onApply} className="gap-2">
          <span>Apply This Configuration to Estimate</span>
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
});
