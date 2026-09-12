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

const ACCENT_STYLES: Record<NonNullable<StatCardProps["accent"]>, string> = {
  default: "border-border",
  green:
    "border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-500/5 to-transparent",
  blue: "border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-500/5 to-transparent",
  amber:
    "border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-500/5 to-transparent",
  red: "border-red-200 dark:border-red-800 bg-gradient-to-br from-red-500/5 to-transparent",
  purple:
    "border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-500/5 to-transparent",
};

const TREND_COLORS = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-red-500 dark:text-red-400",
  flat: "text-muted-foreground",
};

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
            <div className="p-1.5 rounded-lg bg-background border shadow-2xs text-muted-foreground shrink-0">
              {icon}
            </div>
          )}
        </div>
        <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">{value}</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          {trend && (
            <span className={cn("flex items-center gap-0.5 text-xs font-semibold", TREND_COLORS[trend])}>
              {trend === "up" ? (
                <TrendingUp className="size-3" />
              ) : trend === "down" ? (
                <TrendingDown className="size-3" />
              ) : (
                <Minus className="size-3" />
              )}
              {trendLabel}
            </span>
          )}
          {hint && (
            <p className={cn("text-xs text-muted-foreground", trend && "before:content-['·'] before:mr-1.5")}>
              {hint}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
