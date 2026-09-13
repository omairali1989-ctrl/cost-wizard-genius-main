import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  trend?: "up" | "down" | "flat";
  trendLabel?: string | undefined;
  icon?: React.ReactNode;
  accent?: "default" | "green" | "blue" | "amber" | "red" | "purple";
}

// Only states that need attention carry colour; the rest read as plain cards.
const ACCENT_STYLES: Record<NonNullable<StatCardProps["accent"]>, string> = {
  default: "border-border",
  green: "border-border",
  blue: "border-border",
  purple: "border-border",
  amber: "border-warning",
  red: "border-destructive",
};

const TREND_STYLES = {
  up: "text-foreground",
  down: "text-destructive",
  flat: "text-muted-foreground",
};

const TREND_DESCRIPTION = { up: "Trending up", down: "Trending down", flat: "Flat" };

export const StatCard = React.memo(function StatCard({
  label,
  value,
  hint,
  trend,
  trendLabel,
  icon,
  accent = "default",
}: StatCardProps) {
  return (
    <Card className={cn("transition-all hover:shadow-sm", ACCENT_STYLES[accent])}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            {label}
          </p>
          {icon && (
            <div
              aria-hidden="true"
              className="p-1.5 rounded-lg bg-background border shadow-2xs text-muted-foreground shrink-0"
            >
              {icon}
            </div>
          )}
        </div>
        <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">{value}</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          {trend && (
            <span
              className={cn("flex items-center gap-0.5 text-xs font-semibold", TREND_STYLES[trend])}
            >
              {trend === "up" ? (
                <TrendingUp className="size-3" aria-hidden="true" />
              ) : trend === "down" ? (
                <TrendingDown className="size-3" aria-hidden="true" />
              ) : (
                <Minus className="size-3" aria-hidden="true" />
              )}
              {/* Direction must not be conveyed by the icon and its colour alone. */}
              <span className="sr-only">{TREND_DESCRIPTION[trend]}.</span>
              {trendLabel}
            </span>
          )}
          {hint && (
            <p
              className={cn(
                "text-xs text-muted-foreground",
                trend && "before:content-['·'] before:mr-1.5",
              )}
            >
              {hint}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
