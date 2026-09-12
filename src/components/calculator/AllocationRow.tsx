import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney, type Allocation, type TimeUnit } from "@/lib/pricing";

export interface TeamMemberRate {
  id: string;
  name: string;
  job_title?: string | null;
  department?: string | null;
  hourly_cost: number;
}

interface AllocationRowProps {
  phaseId: string;
  allocation: Allocation;
  employees: TeamMemberRate[];
  rateFor: (id: string) => number;
  currency?: string;
  onUpdate: (phaseId: string, allocId: string, patch: Partial<Allocation>) => void;
  onRemove: (phaseId: string, allocId: string) => void;
}

export const AllocationRow = React.memo(function AllocationRow({
  phaseId,
  allocation: a,
  employees,
  rateFor,
  currency = "PKR",
  onUpdate,
  onRemove,
}: AllocationRowProps) {
  const [unit, setUnit] = React.useState<TimeUnit>("hours");

  const displayValue = React.useMemo(() => {
    if (!a.hours) return "";
    switch (unit) {
      case "days":
        return Math.round((a.hours / 8) * 10) / 10;
      case "weeks":
        return Math.round((a.hours / 40) * 10) / 10;
      case "months":
        return Math.round((a.hours / 160) * 10) / 10;
      case "hours":
      default:
        return a.hours;
    }
  }, [a.hours, unit]);

  const lineCost = React.useMemo(() => {
    return (Number(a.hours) || 0) * (Number(a.hourlyCost) || 0);
  }, [a.hours, a.hourlyCost]);

  const durationEquiv = React.useMemo(() => {
    const h = Number(a.hours) || 0;
    if (h <= 0) return "";
    const days = Math.round((h / 8) * 10) / 10;
    const weeks = Math.round((h / 40) * 10) / 10;
    if (weeks >= 1) return `~${weeks}w (${days}d)`;
    if (days >= 1) return `~${days}d (${h}h)`;
    return `${h}h`;
  }, [a.hours]);

  const handlePersonChange = React.useCallback(
    (v: string) => {
      if (v === "custom") {
        onUpdate(phaseId, a.id, {
          employeeId: null,
          hourlyCost: a.hourlyCost,
          label: a.label || "Custom Specialist",
        });
        return;
      }
      const emp = employees.find((e) => e.id === v);
      onUpdate(phaseId, a.id, {
        employeeId: v,
        hourlyCost: rateFor(v),
        label: a.label && a.label !== "Custom Specialist" ? a.label : (emp?.job_title ?? emp?.name ?? a.label),
      });
    },
    [phaseId, a.id, a.hourlyCost, a.label, employees, rateFor, onUpdate],
  );

  const handleLabelChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(phaseId, a.id, { label: e.target.value });
    },
    [phaseId, a.id, onUpdate],
  );

  const handleDurationChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      let calculatedHours = val;
      switch (unit) {
        case "days":
          calculatedHours = val * 8;
          break;
        case "weeks":
          calculatedHours = val * 40;
          break;
        case "months":
          calculatedHours = val * 160;
          break;
        case "hours":
        default:
          calculatedHours = val;
          break;
      }
      onUpdate(phaseId, a.id, { hours: calculatedHours });
    },
    [phaseId, a.id, unit, onUpdate],
  );

  const handleCostChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(phaseId, a.id, {
        hourlyCost: Number(e.target.value),
        rateOverridden: true,
      });
    },
    [phaseId, a.id, onUpdate],
  );

  const handleRemove = React.useCallback(() => {
    onRemove(phaseId, a.id);
  }, [phaseId, a.id, onRemove]);

  // Group employees for structured select dropdown
  const groupedEmployees = React.useMemo(() => {
    const dev: TeamMemberRate[] = [];
    const design: TeamMemberRate[] = [];
    const pm: TeamMemberRate[] = [];
    const mgmt: TeamMemberRate[] = [];

    employees.forEach((emp) => {
      const title = (emp.job_title || "").toLowerCase();
      const dept = (emp.department || "").toLowerCase();
      if (title.includes("design") || dept.includes("design")) {
        design.push(emp);
      } else if (title.includes("project manager") || title.includes("qa") || title.includes("quality")) {
        pm.push(emp);
      } else if (title.includes("director") || title.includes("sales") || dept.includes("sales") || dept.includes("management")) {
        mgmt.push(emp);
      } else {
        dev.push(emp);
      }
    });

    return { dev, design, pm, mgmt };
  }, [employees]);

  return (
    <div className="grid gap-2 rounded-lg border border-border/60 bg-card/40 p-2 sm:grid-cols-[1.6fr_1.3fr_1.4fr_1fr_1.2fr_auto] items-center text-xs">
      {/* Employee Select */}
      <Select value={a.employeeId ?? "custom"} onValueChange={handlePersonChange}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Select team member" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value="custom">
            <span className="font-medium text-foreground">Custom Role / Contractor</span>
          </SelectItem>

          {groupedEmployees.dev.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                💻 Engineering & Development
              </SelectLabel>
              {groupedEmployees.dev.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{e.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {e.job_title ?? "Developer"} · {formatMoney(e.hourly_cost, currency)}/hr
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          )}

          {groupedEmployees.design.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                🎨 UI/UX & Design
              </SelectLabel>
              {groupedEmployees.design.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{e.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {e.job_title ?? "Designer"} · {formatMoney(e.hourly_cost, currency)}/hr
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          )}

          {groupedEmployees.pm.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                📋 Project Management & QA
              </SelectLabel>
              {groupedEmployees.pm.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{e.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {e.job_title ?? "PM / QA"} · {formatMoney(e.hourly_cost, currency)}/hr
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          )}

          {groupedEmployees.mgmt.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                💼 Leadership & Sales
              </SelectLabel>
              {groupedEmployees.mgmt.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{e.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {e.job_title ?? "Management"} · {formatMoney(e.hourly_cost, currency)}/hr
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>

      {/* Role / Task Label */}
      <Input
        placeholder="Role / Task label"
        value={a.label}
        onChange={handleLabelChange}
        className="h-9 text-xs"
      />

      {/* Time & Unit Input with duration pill */}
      <div className="flex flex-col gap-0.5">
        <div className="flex gap-1 items-center">
          <Input
            type="number"
            placeholder={unit === "hours" ? "Hours" : unit === "days" ? "Days" : unit === "weeks" ? "Weeks" : "Months"}
            value={displayValue}
            onChange={handleDurationChange}
            className="h-9 min-w-[65px] text-xs font-mono"
          />
          <Select value={unit} onValueChange={(u) => setUnit(u as TimeUnit)}>
            <SelectTrigger className="h-9 w-[68px] px-1.5 text-xs shrink-0 font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hours">hrs</SelectItem>
              <SelectItem value="days">days</SelectItem>
              <SelectItem value="weeks">wks</SelectItem>
              <SelectItem value="months">mo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {durationEquiv && (
          <span className="text-[10px] text-muted-foreground px-1 font-mono">
            {durationEquiv}
          </span>
        )}
      </div>

      {/* Hourly Cost Input */}
      <div className="relative">
        <Input
          type="number"
          placeholder="Rate/hr"
          value={a.hourlyCost || ""}
          onChange={handleCostChange}
          className="h-9 text-xs font-mono pr-7"
        />
        <span className="absolute right-2 top-2.5 text-[10px] text-muted-foreground pointer-events-none">
          /hr
        </span>
      </div>

      {/* Line Item Total Cost Display */}
      <div className="flex flex-col items-end justify-center px-1">
        <span className="font-semibold text-foreground tabular text-xs">
          {formatMoney(lineCost, currency)}
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">
          {Math.round(a.hours || 0)}h @ {formatMoney(a.hourlyCost || 0, currency)}
        </span>
      </div>

      {/* Delete Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleRemove}
        aria-label="Delete allocation"
        className="size-8 text-muted-foreground hover:text-destructive shrink-0"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
});
