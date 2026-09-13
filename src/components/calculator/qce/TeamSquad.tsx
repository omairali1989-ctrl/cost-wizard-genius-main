// ─── TeamSquad ────────────────────────────────────────────────────────────────
// Squad header, available-member chips, group controllers, active member cards
import * as React from "react";
import { Plus, Trash2, Users, UserPlus, Link2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/pricing";
import type { TimeUnit } from "@/lib/pricing";
import type { RoleGroup, TeamMemberRate, MemberAllocation, TeamGroupDuration } from "./types";
import { ROLE_GROUP_INFO, getEmployeeRoleGroup } from "./types";
import { TeamGroupController } from "./TeamGroupController";

export interface AssignedPerson {
  employee: TeamMemberRate;
  hours: number;
  days: number;
  weeks: number;
  months: number;
  hourlyCost: number;
  totalCost: number;
  alloc: MemberAllocation;
  roleGroup: RoleGroup;
}

interface TeamSquadProps {
  employees: TeamMemberRate[];
  currency: string;
  durationValue: number;
  durationUnit: TimeUnit;
  allocations: Record<string, MemberAllocation>;
  groupDurations: Record<RoleGroup, TeamGroupDuration>;
  assignedPeople: AssignedPerson[];
  unassignedEmployees: TeamMemberRate[];
  // Counts per group
  devCount: number;
  designCount: number;
  pmQaCount: number;
  leadCount: number;
  devHours: number;
  designHours: number;
  pmQaHours: number;
  leadershipHours: number;
  // Handlers
  onAddMember: (empId: string) => void;
  onRemoveMember: (empId: string) => void;
  onUpdateAllocation: (empId: string, patch: Partial<MemberAllocation>) => void;
  onGroupDurationChange: (group: RoleGroup, value: number, unit: TimeUnit) => void;
  onGroupSyncProject: (group: RoleGroup) => void;
  onGroupIncrementDays: (group: RoleGroup, delta: number) => void;
  onGroupPercentAdjust: (group: RoleGroup, pct: number) => void;
  onIndividualIncrementDays: (empId: string, delta: number) => void;
}

const ALL_GROUPS: RoleGroup[] = ["dev", "design", "pm_qa", "leadership"];

export const TeamSquad = React.memo(function TeamSquad({
  employees,
  currency,
  durationValue,
  durationUnit,
  allocations,
  groupDurations,
  assignedPeople,
  unassignedEmployees,
  devCount,
  designCount,
  pmQaCount,
  leadCount,
  devHours,
  designHours,
  pmQaHours,
  leadershipHours,
  onAddMember,
  onRemoveMember,
  onUpdateAllocation,
  onGroupDurationChange,
  onGroupSyncProject,
  onGroupIncrementDays,
  onGroupPercentAdjust,
  onIndividualIncrementDays,
}: TeamSquadProps) {
  const [activeGroupFilter, setActiveGroupFilter] = React.useState<"all" | RoleGroup>("all");

  const filteredAssignedPeople = React.useMemo(() => {
    if (activeGroupFilter === "all") return assignedPeople;
    return assignedPeople.filter((p) => p.roleGroup === activeGroupFilter);
  }, [assignedPeople, activeGroupFilter]);

  const groupHours: Record<RoleGroup, number> = {
    dev: devHours,
    design: designHours,
    pm_qa: pmQaHours,
    leadership: leadershipHours,
  };
  const groupCounts: Record<RoleGroup, number> = {
    dev: devCount,
    design: designCount,
    pm_qa: pmQaCount,
    leadership: leadCount,
  };

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Label className="text-sm font-semibold">3. Team Squad &amp; Resource Allocation</Label>
            <Badge variant="secondary" className="text-[11px] font-semibold">
              {assignedPeople.length} members active ·{" "}
              {Math.round(assignedPeople.reduce((s, p) => s + p.hours, 0))} hrs total
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Set number of days/weeks/months for Dev &amp; Design teams to adjust all members
            automatically, or customize any individual.
          </p>
        </div>

        {/* Add member dropdown */}
        <div className="shrink-0">
          <Select
            value=""
            onValueChange={(empId) => {
              if (empId) onAddMember(empId);
            }}
          >
            <SelectTrigger className="h-8 text-xs bg-primary text-primary-foreground font-semibold px-2.5 w-auto min-w-[190px] border-primary hover:bg-primary/90 cursor-pointer">
              <UserPlus className="size-3.5 mr-1.5 shrink-0" />
              <span>+ Add Individual Member</span>
            </SelectTrigger>
            <SelectContent align="end" className="max-h-72">
              {unassignedEmployees.length === 0 ? (
                <div className="p-2 text-xs text-muted-foreground text-center">
                  All company members are in the squad!
                </div>
              ) : (
                unassignedEmployees.map((emp) => {
                  const group = getEmployeeRoleGroup(emp);
                  const groupInfo = ROLE_GROUP_INFO[group];
                  return (
                    <SelectItem key={emp.id} value={emp.id}>
                      <div className="flex items-center justify-between gap-3 text-left">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <groupInfo.icon
                            className="size-3.5 text-muted-foreground"
                            aria-hidden="true"
                          />
                          {emp.name}
                        </span>
                        <span className="text-xs text-muted-foreground">({emp.job_title})</span>
                        <span className="text-[11px] font-mono font-medium text-primary">
                          {formatMoney(emp.hourly_cost, currency)}/hr
                        </span>
                      </div>
                    </SelectItem>
                  );
                })
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick-add chips bar */}
      {unassignedEmployees.length > 0 && (
        <div className="rounded-xl bg-muted/40 border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Users className="size-3.5 text-primary" />
              <span>Available Company Members (Click to Add to Squad):</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-background font-semibold text-muted-foreground border">
              {unassignedEmployees.length} available
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap max-h-24 overflow-y-auto pr-1">
            {unassignedEmployees.map((emp) => {
              const group = getEmployeeRoleGroup(emp);
              const info = ROLE_GROUP_INFO[group];
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => onAddMember(emp.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-card hover:bg-primary/10 hover:border-primary/50 border shadow-2xs transition-all text-left"
                  title={`Add ${emp.name} (${emp.job_title}) at ${formatMoney(emp.hourly_cost, currency)}/hr`}
                >
                  <Plus className="size-3 text-primary shrink-0" />
                  <info.icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <span className="font-semibold text-foreground">{emp.name}</span>
                  <span className="text-[10px] text-muted-foreground">({emp.job_title})</span>
                  <span className="text-[10px] font-mono text-primary font-semibold">
                    {formatMoney(emp.hourly_cost, currency)}/hr
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Team duration hub */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <span></span>
            <span>Team Duration &amp; Auto-Adjustment Hub</span>
          </Label>
          <span className="text-[11px] text-muted-foreground">
            Adjust days/weeks/months to recalculate entire team squad in real-time
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {ALL_GROUPS.map((group) => (
            <TeamGroupController
              key={group}
              group={group}
              duration={groupDurations[group]}
              activeCount={groupCounts[group]}
              totalHours={groupHours[group]}
              projectDurationValue={durationValue}
              projectDurationUnit={durationUnit}
              onDurationChange={onGroupDurationChange}
              onSyncProject={onGroupSyncProject}
              onIncrementDays={onGroupIncrementDays}
              onPercentAdjust={onGroupPercentAdjust}
            />
          ))}
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            { key: "all", label: `All Active (${assignedPeople.length})` },
            { key: "dev", label: `Development (${devCount})` },
            { key: "design", label: `Design (${designCount})` },
            { key: "pm_qa", label: `PM & QA (${pmQaCount})` },
            { key: "leadership", label: `Leadership (${leadCount})` },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveGroupFilter(key as "all" | RoleGroup)}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition ${
              activeGroupFilter === key
                ? "bg-primary text-primary-foreground font-semibold"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Active member cards */}
      {filteredAssignedPeople.length === 0 ? (
        <div className="p-6 text-center border rounded-xl bg-muted/20 text-xs text-muted-foreground">
          No members active in this category. Click any member in the &quot;Available Company
          Members&quot; bar above to add someone.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredAssignedPeople.map(
            ({
              employee: emp,
              hours,
              days,
              weeks,
              months,
              hourlyCost,
              totalCost,
              alloc,
              roleGroup,
            }) => {
              const groupInfo = ROLE_GROUP_INFO[roleGroup];
              return (
                <MemberCard
                  key={emp.id}
                  emp={emp}
                  hours={hours}
                  days={days}
                  weeks={weeks}
                  months={months}
                  hourlyCost={hourlyCost}
                  totalCost={totalCost}
                  alloc={alloc}
                  groupInfo={groupInfo}
                  currency={currency}
                  durationUnit={durationUnit}
                  onRemove={() => onRemoveMember(emp.id)}
                  onUpdateAllocation={(patch) => onUpdateAllocation(emp.id, patch)}
                  onIncrementDays={(delta) => onIndividualIncrementDays(emp.id, delta)}
                />
              );
            },
          )}
        </div>
      )}
    </div>
  );
});

// ─── MemberCard (internal) ─────────────────────────────────────────────────────
interface MemberCardProps {
  emp: TeamMemberRate;
  hours: number;
  days: number;
  weeks: number;
  months: number;
  hourlyCost: number;
  totalCost: number;
  alloc: MemberAllocation;
  groupInfo: { label: string; icon: LucideIcon; badgeClass: string };
  currency: string;
  durationUnit: TimeUnit;
  onRemove: () => void;
  onUpdateAllocation: (patch: Partial<MemberAllocation>) => void;
  onIncrementDays: (delta: number) => void;
}

function MemberCard({
  emp,
  hours,
  days,
  weeks,
  months,
  hourlyCost,
  totalCost,
  alloc,
  groupInfo,
  currency,
  durationUnit,
  onRemove,
  onUpdateAllocation,
  onIncrementDays,
}: MemberCardProps) {
  return (
    <div className="flex flex-col justify-between p-3.5 rounded-xl border bg-card/90 shadow-2xs hover:border-primary/40 transition gap-3">
      {/* Name & badges row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${groupInfo.badgeClass}`}
            >
              {groupInfo.label}
            </span>
            {alloc.mode === "custom" ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning dark:border-warning">
                Custom: {alloc.customValue} {alloc.customUnit}
              </span>
            ) : (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-foreground border border-border dark:border-border">
                Synced with {groupInfo.label} ({alloc.percent}%)
              </span>
            )}
          </div>
          <p className="font-semibold text-sm truncate mt-1.5 leading-tight text-foreground">
            {emp.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">{emp.job_title}</p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={onRemove}
          title="Remove member"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {/* Cost & time summary */}
      <div className="flex items-center justify-between bg-muted/40 rounded-lg p-2.5 text-xs">
        <div>
          <span className="font-semibold text-foreground text-sm">
            {durationUnit === "days"
              ? `${days} days`
              : durationUnit === "weeks"
                ? `${weeks} wks (${days} days)`
                : durationUnit === "months"
                  ? `${months} mo (${days} days)`
                  : `${hours} hrs`}
          </span>
          <span className="text-[11px] text-muted-foreground block mt-0.5">
            {hours} hrs @ {formatMoney(hourlyCost, currency)}/hr
          </span>
        </div>
        <div className="text-right">
          <span className="font-bold text-base text-primary font-display">
            {formatMoney(totalCost, currency)}
          </span>
          <span className="text-[10px] text-muted-foreground block">Allocated Cost</span>
        </div>
      </div>

      {/* Individual allocation controller */}
      <div className="pt-2 border-t space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">Individual Allocation:</span>
          {alloc.mode === "custom" ? (
            <button
              type="button"
              onClick={() => onUpdateAllocation({ mode: "sync", percent: 100 })}
              className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
            >
              <Link2 className="size-3" />
              <span>Sync with {groupInfo.label}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                onUpdateAllocation({
                  mode: "custom",
                  customValue: Math.round(days) || 1,
                  customUnit: "days",
                })
              }
              className="text-[11px] text-warning hover:underline flex items-center gap-1 font-medium"
            >
              <span>Custom Days/Weeks</span>
            </button>
          )}
        </div>

        {alloc.mode === "custom" ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={1}
                aria-label="Custom allocation amount"
                value={alloc.customValue}
                onChange={(e) =>
                  onUpdateAllocation({
                    customValue: Math.max(1, Number(e.target.value)),
                  })
                }
                className="h-7 w-16 text-xs px-2"
              />
              <Select
                value={alloc.customUnit ?? "days"}
                onValueChange={(u) => onUpdateAllocation({ customUnit: u as TimeUnit })}
              >
                <SelectTrigger className="h-7 text-xs px-2 w-[88px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">days (8h)</SelectItem>
                  <SelectItem value="weeks">wks (40h)</SelectItem>
                  <SelectItem value="months">mo (160h)</SelectItem>
                  <SelectItem value="hours">hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1 ml-auto">
              {([-1, 1, 5] as const).map((delta) => (
                <Button
                  key={delta}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] px-1.5"
                  onClick={() => onIncrementDays(delta)}
                  title={delta === -1 ? "-1 Day" : delta === 1 ? "+1 Day" : "+1 Week (5 days)"}
                >
                  {delta === -1 ? "-1d" : delta === 1 ? "+1d" : "+1w"}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1 flex-wrap">
            {[100, 50, 25, 10].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => onUpdateAllocation({ percent: pct })}
                className={`text-xs px-2 py-0.5 rounded font-medium transition ${
                  alloc.percent === pct
                    ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {pct === 100
                  ? "Full (100%)"
                  : pct === 50
                    ? "Half (50%)"
                    : pct === 25
                      ? "Part (25%)"
                      : "Advisory (10%)"}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
