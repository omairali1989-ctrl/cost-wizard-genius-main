// ─── TeamGroupController ──────────────────────────────────────────────────────
// Reusable per-group duration control card (Dev / Design / PM&QA / Leadership)
import * as React from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TimeUnit } from "@/lib/pricing";
import type { RoleGroup, TeamGroupDuration } from "./types";
import { ROLE_GROUP_INFO } from "./types";

const GROUP_ACCENT: Record<RoleGroup, { border: string; badge: string }> = {
  dev: {
    border: "border-border hover:border-border",
    badge: "bg-muted text-foreground border-border dark:border-border",
  },
  design: {
    border: "border-border hover:border-border",
    badge: "bg-muted text-foreground border-border dark:border-border",
  },
  pm_qa: {
    border: "border-border hover:border-border",
    badge: "bg-muted text-foreground border-border dark:border-border",
  },
  leadership: {
    border: "border-warning hover:border-warning",
    badge: "bg-warning/10 text-warning border-warning dark:border-warning",
  },
};

interface TeamGroupControllerProps {
  group: RoleGroup;
  duration: TeamGroupDuration;
  activeCount: number;
  totalHours: number;
  projectDurationValue: number;
  projectDurationUnit: TimeUnit;
  onDurationChange: (group: RoleGroup, value: number, unit: TimeUnit) => void;
  onSyncProject: (group: RoleGroup) => void;
  onIncrementDays: (group: RoleGroup, delta: number) => void;
  onPercentAdjust: (group: RoleGroup, pct: number) => void;
}

export const TeamGroupController = React.memo(function TeamGroupController({
  group,
  duration,
  activeCount,
  totalHours,
  projectDurationValue,
  projectDurationUnit,
  onDurationChange,
  onSyncProject,
  onIncrementDays,
  onPercentAdjust,
}: TeamGroupControllerProps) {
  const info = ROLE_GROUP_INFO[group];
  const accent = GROUP_ACCENT[group];
  const isSynced = duration.mode === "sync_project";

  const memberLabel =
    group === "dev"
      ? activeCount === 1
        ? "developer"
        : "developers"
      : group === "design"
        ? activeCount === 1
          ? "designer"
          : "designers"
        : "active";

  // Leadership group has a simpler layout (no day nudge buttons, advisory %)
  const isLeadership = group === "leadership";

  return (
    <div
      className={`p-3.5 rounded-xl border bg-card/60 shadow-2xs space-y-2.5 transition ${accent.border}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <info.icon className="size-4 text-muted-foreground" aria-hidden="true" />
          <div>
            <h4 className="text-xs font-bold leading-tight text-foreground">{info.label}</h4>
            <p className="text-[11px] text-muted-foreground">
              {activeCount} {memberLabel} · {Math.round(totalHours)} hrs total
            </p>
          </div>
        </div>

        {isLeadership ? (
          <Badge variant="outline" className={`text-[10px] font-semibold ${accent.badge}`}>
            Strategic Oversight
          </Badge>
        ) : isSynced ? (
          <Badge variant="outline" className={`text-[10px] gap-1 font-semibold ${accent.badge}`}>
            <Link2 className="size-2.5" />
            <span>
              Synced ({projectDurationValue} {projectDurationUnit})
            </span>
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-[10px] bg-warning/10 text-warning border-warning dark:border-warning gap-1 font-semibold"
          >
            Custom Schedule
          </Badge>
        )}
      </div>

      {/* Duration inputs */}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1 flex-1">
          <Input
            type="number"
            min={1}
            aria-label={`${group} duration`}
            value={duration.value}
            onChange={(e) =>
              onDurationChange(group, Math.max(1, Number(e.target.value)), duration.unit)
            }
            className="h-8 w-16 text-xs px-2 font-semibold"
          />
          <Select
            value={duration.unit}
            onValueChange={(u) => onDurationChange(group, duration.value, u as TimeUnit)}
          >
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="days">Days (8h)</SelectItem>
              <SelectItem value="weeks">Weeks (40h)</SelectItem>
              <SelectItem value="months">Months (160h)</SelectItem>
              <SelectItem value="hours">Hours</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Day nudge buttons (not shown for leadership) */}
        {!isLeadership && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs px-2"
              onClick={() => onIncrementDays(group, -1)}
              title="Subtract 1 day"
            >
              -1d
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs px-2"
              onClick={() => onIncrementDays(group, 1)}
              title="Add 1 day"
            >
              +1d
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs px-2"
              onClick={() => onIncrementDays(group, 5)}
              title="Add 1 week (5 days)"
            >
              +1w
            </Button>
          </div>
        )}

        {/* Leadership advisory button */}
        {isLeadership && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs px-2"
            onClick={() => onPercentAdjust(group, 10)}
            title="Set Advisory Allocation (10%)"
          >
            10% Advisory
          </Button>
        )}
      </div>

      {/* Quick actions bar */}
      <div className="flex items-center justify-between gap-1 flex-wrap pt-1.5 border-t border-border/60">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-[11px] px-2 text-primary hover:bg-primary/10 gap-1 font-medium"
          onClick={() => onSyncProject(group)}
        >
          <Link2 className="size-3" />
          <span>
            Match Project
            {!isLeadership && ` (${projectDurationValue} ${projectDurationUnit})`}
          </span>
        </Button>

        {isLeadership ? (
          <span className="text-[10px] text-muted-foreground">Directors &amp; Sales Advisory</span>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-[10px] px-1.5"
              onClick={() => onPercentAdjust(group, 100)}
            >
              100% Full
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-[10px] px-1.5"
              onClick={() => onPercentAdjust(group, 50)}
            >
              50% Half
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});
