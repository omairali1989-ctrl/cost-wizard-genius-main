// ─── QuickCostEstimator ───────────────────────────────────────────────────────
// Orchestrator: state, derived calculations, event handlers.
// All rendering is delegated to focused sub-components in ./qce/
import * as React from "react";
import {
  formatMoney,
  type CalculationInputs,
  type TimeUnit,
  unitToHours,
  HOURS_PER_DAY,
  HOURS_PER_WEEK,
  HOURS_PER_MONTH,
} from "@/lib/pricing";

import { PresetSelector } from "./qce/PresetSelector";
import { ProjectDetails } from "./qce/ProjectDetails";
import { TeamSquad } from "./qce/TeamSquad";
import { CostSummaryPanel } from "./qce/CostSummaryPanel";
import { PRESETS } from "./qce/presets";
import { usePresetLibrary } from "./qce/presetLibrary";
import {
  type RoleGroup,
  type TeamMemberRate,
  type MemberAllocation,
  type TeamGroupDuration,
  type ProjectPresetId,
  type PresetConfig,
  getEmployeeRoleGroup,
} from "./qce/types";

// Re-export shared types so existing import sites still work
export type { RoleGroup, MemberAllocation, TeamGroupDuration, ProjectPresetId, PresetConfig };
export { getEmployeeRoleGroup, ROLE_GROUP_INFO } from "./qce/types";
export { PRESETS } from "./qce/presets";
// Keep backward-compat alias used by DetailedBreakdownView / calculator.tsx
export type { PresetCategory } from "./qce/types";

interface QuickCostEstimatorProps {
    companyId?: string;
  employees: TeamMemberRate[];
  currency: string;
  marginPct: number;
  salesCommissionPct: number;
  contingencyPct: number;
  onApplyPreset: (inputs: Partial<CalculationInputs>) => void;
  onSync?: (inputs: Partial<CalculationInputs>) => void;
}

export const QuickCostEstimator = React.memo(function QuickCostEstimator({
    companyId,
    const { presets } = usePresetLibrary(companyId);
  employees,
  currency,
  marginPct,
  salesCommissionPct,
  contingencyPct,
  onApplyPreset,
  onSync,
}: QuickCostEstimatorProps) {
  const { presets } = usePresetLibrary();
  // ─── Core state ──────────────────────────────────────────────────────────
  const [selectedPreset, setSelectedPreset] =
    React.useState<ProjectPresetId>("mvp");
  const [durationValue, setDurationValue] = React.useState<number>(4);
  const [durationUnit, setDurationUnit] = React.useState<TimeUnit>("weeks");
  const [projectName, setProjectName] = React.useState(
    "Startup MVP (Fast-Track) Estimate"
  );
  const [clientName, setClientName] = React.useState("");

  // employeeId → allocation settings
  const [allocations, setAllocations] = React.useState<
    Record<string, MemberAllocation>
  >({});

  // Per-role-group duration (can be synced to project or custom)
  const [groupDurations, setGroupDurations] = React.useState<
    Record<RoleGroup, TeamGroupDuration>
  >({
    dev: { mode: "sync_project", value: 4, unit: "weeks" },
    design: { mode: "sync_project", value: 4, unit: "weeks" },
    pm_qa: { mode: "sync_project", value: 4, unit: "weeks" },
    leadership: { mode: "sync_project", value: 4, unit: "weeks" },
  });

  // ─── Preset selection ─────────────────────────────────────────────────────
  const handlePresetSelect = React.useCallback(
    (preset: PresetConfig) => {
      setSelectedPreset(preset.id);
      setDurationValue(preset.defaultDurationValue);
      setDurationUnit(preset.defaultDurationUnit);
      setProjectName(`${preset.title} Estimate`);

      setGroupDurations({
        dev: {
          mode: "sync_project",
          value: preset.defaultDurationValue,
          unit: preset.defaultDurationUnit,
        },
        design: {
          mode: "sync_project",
          value: preset.defaultDurationValue,
          unit: preset.defaultDurationUnit,
        },
        pm_qa: {
          mode: "sync_project",
          value: preset.defaultDurationValue,
          unit: preset.defaultDurationUnit,
        },
        leadership: {
          mode: "sync_project",
          value: preset.defaultDurationValue,
          unit: preset.defaultDurationUnit,
        },
      });

      const newAllocs: Record<string, MemberAllocation> = {};
      for (const s of preset.suggestedRoles) {
        const match = employees.find((e) =>
          e.name.toLowerCase().includes(s.nameSubstr.toLowerCase())
        );
        if (match) {
          newAllocs[match.id] = {
            mode: "sync",
            percent: s.allocationPct,
            customValue: Math.max(
              1,
              Math.round(
                preset.defaultDurationValue * (s.allocationPct / 100)
              )
            ),
            customUnit: preset.defaultDurationUnit,
          };
        }
      }
      setAllocations(newAllocs);
    },
    [employees]
  );

  // Initialize with first preset once employees load
  React.useEffect(() => {
    const first = presets[0];
    if (first) handlePresetSelect(first);
  }, [employees, presets]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Project duration ─────────────────────────────────────────────────────
  const handleProjectDurationChange = React.useCallback(
    (val: number, unit: TimeUnit) => {
      const safeVal = Math.max(1, val);
      setDurationValue(safeVal);
      setDurationUnit(unit);
      setGroupDurations((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next) as RoleGroup[]) {
          if (next[k].mode === "sync_project") {
            next[k] = { ...next[k], value: safeVal, unit };
          }
        }
        return next;
      });
    },
    []
  );

  // ─── Group duration controls ──────────────────────────────────────────────
  const handleGroupDurationChange = React.useCallback(
    (group: RoleGroup, val: number, unit: TimeUnit) => {
      setGroupDurations((prev) => ({
        ...prev,
        [group]: { mode: "custom", value: Math.max(1, val), unit },
      }));
    },
    []
  );

  const handleGroupSyncProject = React.useCallback(
    (group: RoleGroup) => {
      setGroupDurations((prev) => ({
        ...prev,
        [group]: { mode: "sync_project", value: durationValue, unit: durationUnit },
      }));
    },
    [durationValue, durationUnit]
  );

  const handleGroupIncrementDays = React.useCallback(
    (group: RoleGroup, daysDelta: number) => {
      setGroupDurations((prev) => {
        const curr = prev[group];
        const currHours = unitToHours(curr.value, curr.unit, HOURS_PER_DAY);
        const newHours = Math.max(
          HOURS_PER_DAY,
          currHours + daysDelta * HOURS_PER_DAY
        );

        let newVal = Math.round((newHours / HOURS_PER_DAY) * 10) / 10;
        let newUnit: TimeUnit = "days";

        if (curr.unit === "weeks" && newHours % HOURS_PER_WEEK === 0) {
          newVal = Math.round(newHours / HOURS_PER_WEEK);
          newUnit = "weeks";
        } else if (
          curr.unit === "months" &&
          newHours % HOURS_PER_MONTH === 0
        ) {
          newVal = Math.round(newHours / HOURS_PER_MONTH);
          newUnit = "months";
        }

        return {
          ...prev,
          [group]: { mode: "custom", value: newVal, unit: newUnit },
        };
      });
    },
    []
  );

  const handleGroupPercentAdjust = React.useCallback(
    (group: RoleGroup, pct: number) => {
      setAllocations((prev) => {
        const next = { ...prev };
        for (const emp of employees) {
          if (getEmployeeRoleGroup(emp) === group && next[emp.id]) {
            next[emp.id] = { ...next[emp.id], mode: "sync", percent: pct };
          }
        }
        return next;
      });
    },
    [employees]
  );

  // ─── Individual member controls ───────────────────────────────────────────
  const addIndividualMember = React.useCallback(
    (empId: string) => {
      const emp = employees.find((e) => e.id === empId);
      const roleGroup = emp ? getEmployeeRoleGroup(emp) : "dev";
      const teamDur = groupDurations[roleGroup] || {
        mode: "sync_project" as const,
        value: durationValue,
        unit: durationUnit,
      };
      setAllocations((prev) => ({
        ...prev,
        [empId]: {
          mode: "sync",
          percent: 100,
          customValue: teamDur.value,
          customUnit: teamDur.unit,
        },
      }));
    },
    [employees, groupDurations, durationValue, durationUnit]
  );

  const removeIndividualMember = React.useCallback((empId: string) => {
    setAllocations((prev) => {
      const next = { ...prev };
      delete next[empId];
      return next;
    });
  }, []);

  const updateIndividualAllocation = React.useCallback(
    (empId: string, patch: Partial<MemberAllocation>) => {
      setAllocations((prev) => {
        const curr = prev[empId] || {
          mode: "sync" as const,
          percent: 100,
          customValue: durationValue,
          customUnit: durationUnit,
        };
        return { ...prev, [empId]: { ...curr, ...patch } };
      });
    },
    [durationValue, durationUnit]
  );

  const handleIndividualIncrementDays = React.useCallback(
    (empId: string, daysDelta: number) => {
      setAllocations((prev) => {
        const curr = prev[empId];
        if (!curr) return prev;

        const emp = employees.find((e) => e.id === empId);
        const roleGroup = emp ? getEmployeeRoleGroup(emp) : "dev";
        const teamDur = groupDurations[roleGroup] || {
          mode: "sync_project" as const,
          value: durationValue,
          unit: durationUnit,
        };
        const teamBaseHours = unitToHours(
          teamDur.value,
          teamDur.unit,
          HOURS_PER_DAY
        );

        let currHours =
          curr.mode === "custom"
            ? unitToHours(
                curr.customValue ?? 1,
                curr.customUnit ?? "days",
                HOURS_PER_DAY
              )
            : teamBaseHours * ((curr.percent ?? 100) / 100);

        const newHours = Math.max(
          HOURS_PER_DAY,
          currHours + daysDelta * HOURS_PER_DAY
        );
        const newDays = Math.round((newHours / HOURS_PER_DAY) * 10) / 10;

        return {
          ...prev,
          [empId]: {
            mode: "custom",
            percent: curr.percent,
            customValue: newDays,
            customUnit: "days",
          },
        };
      });
    },
    [employees, groupDurations, durationValue, durationUnit]
  );

  // ─── Live calculation ─────────────────────────────────────────────────────
  const liveCalc = React.useMemo(() => {
    let totalHours = 0;
    let laborCost = 0;

    const assignedPeople: Array<{
      employee: TeamMemberRate;
      hours: number;
      days: number;
      weeks: number;
      months: number;
      hourlyCost: number;
      totalCost: number;
      alloc: MemberAllocation;
      roleGroup: RoleGroup;
    }> = [];

    for (const [empId, alloc] of Object.entries(allocations)) {
      const emp = employees.find((e) => e.id === empId);
      if (!emp) continue;

      const roleGroup = getEmployeeRoleGroup(emp);
      const teamDur = groupDurations[roleGroup] || {
        mode: "sync_project" as const,
        value: durationValue,
        unit: durationUnit,
      };
      const teamBaseHours = unitToHours(teamDur.value, teamDur.unit, HOURS_PER_DAY);

      const personHours =
        alloc.mode === "custom"
          ? Math.round(
              unitToHours(
                alloc.customValue ?? 1,
                alloc.customUnit ?? "days",
                HOURS_PER_DAY
              )
            )
          : Math.round(teamBaseHours * ((alloc.percent ?? 100) / 100));

      if (personHours <= 0) continue;

      const personCost = personHours * emp.hourly_cost;
      totalHours += personHours;
      laborCost += personCost;

      assignedPeople.push({
        employee: emp,
        hours: personHours,
        days: Math.round((personHours / HOURS_PER_DAY) * 10) / 10,
        weeks: Math.round((personHours / HOURS_PER_WEEK) * 10) / 10,
        months: Math.round((personHours / HOURS_PER_MONTH) * 10) / 10,
        hourlyCost: emp.hourly_cost,
        totalCost: personCost,
        alloc,
        roleGroup,
      });
    }

    const contingency = laborCost * (contingencyPct / 100);
    const totalCost = laborCost + contingency;

    const m = Math.min(marginPct, 90) / 100;
    const price = m >= 1 ? totalCost : totalCost / (1 - m);
    const profit = price - totalCost;
    const commission = price * (salesCommissionPct / 100);
    const netProfit = profit - commission;

    const pricePerHour = totalHours > 0 ? price / totalHours : 0;
    const costPerHour = totalHours > 0 ? totalCost / totalHours : 0;

    const byGroup = (g: RoleGroup) => assignedPeople.filter((p) => p.roleGroup === g);

    return {
      totalHours,
      laborCost,
      contingency,
      totalCost,
      price,
      profit,
      commission,
      netProfit,
      pricePerHour,
      pricePerDay: pricePerHour * HOURS_PER_DAY,
      pricePerWeek: pricePerHour * HOURS_PER_WEEK,
      pricePerMonth: pricePerHour * HOURS_PER_MONTH,
      costPerHour,
      costPerDay: costPerHour * HOURS_PER_DAY,
      costPerWeek: costPerHour * HOURS_PER_WEEK,
      costPerMonth: costPerHour * HOURS_PER_MONTH,
      assignedPeople,
      devHours: byGroup("dev").reduce((s, p) => s + p.hours, 0),
      designHours: byGroup("design").reduce((s, p) => s + p.hours, 0),
      pmQaHours: byGroup("pm_qa").reduce((s, p) => s + p.hours, 0),
      leadershipHours: byGroup("leadership").reduce((s, p) => s + p.hours, 0),
      devCost: byGroup("dev").reduce((s, p) => s + p.totalCost, 0),
      designCost: byGroup("design").reduce((s, p) => s + p.totalCost, 0),
      pmQaCost: byGroup("pm_qa").reduce((s, p) => s + p.totalCost, 0),
      leadershipCost: byGroup("leadership").reduce((s, p) => s + p.totalCost, 0),
    };
  }, [
    allocations,
    employees,
    groupDurations,
    durationValue,
    durationUnit,
    marginPct,
    salesCommissionPct,
    contingencyPct,
  ]);

  // ─── Sync live state to parent ────────────────────────────────────────────
  React.useEffect(() => {
    if (!onSync) return;
    const currentPreset = presets.find((p) => p.id === selectedPreset);
    onSync({
      projectName,
      clientName,
      description: `${currentPreset?.title || "Custom"} project scoped for ${durationValue} ${durationUnit}.`,
      phases: [
        {
          id: "quick-phase",
          name: "Project Delivery & Development",
          allocations: liveCalc.assignedPeople.map((p) => ({
            id: p.employee.id,
            employeeId: p.employee.id,
            label: p.employee.job_title || p.employee.name,
            hours: p.hours,
            hourlyCost: p.hourlyCost,
          })),
        },
      ],
      contingencyPct,
      marginPct,
      salesCommissionPct,
    });
  }, [
    onSync,
    liveCalc,
    selectedPreset,
    presets,
    projectName,
    clientName,
    durationValue,
    durationUnit,
    contingencyPct,
    marginPct,
    salesCommissionPct,
  ]);

  // ─── Apply to full estimate ───────────────────────────────────────────────
  const handleApply = React.useCallback(() => {
    const currentPreset = presets.find((p) => p.id === selectedPreset);
    onApplyPreset({
      projectName,
      clientName,
      description: `${currentPreset?.title || "Custom"} project scoped for ${durationValue} ${durationUnit}.`,
      phases: [
        {
          id: crypto.randomUUID(),
          name: "Project Delivery & Development",
          allocations: liveCalc.assignedPeople.map((p) => ({
            id: crypto.randomUUID(),
            employeeId: p.employee.id,
            label: p.employee.job_title || p.employee.name,
            hours: p.hours,
            hourlyCost: p.hourlyCost,
          })),
        },
      ],
      contingencyPct,
      marginPct,
      salesCommissionPct,
    });
  }, [
    selectedPreset,
    presets,
    projectName,
    clientName,
    durationValue,
    durationUnit,
    liveCalc,
    contingencyPct,
    marginPct,
    salesCommissionPct,
    onApplyPreset,
  ]);

  // ─── Derived counts ───────────────────────────────────────────────────────
  const unassignedEmployees = React.useMemo(
    () => employees.filter((emp) => !allocations[emp.id]),
    [employees, allocations]
  );

  const devCount = liveCalc.assignedPeople.filter(
    (p) => p.roleGroup === "dev"
  ).length;
  const designCount = liveCalc.assignedPeople.filter(
    (p) => p.roleGroup === "design"
  ).length;
  const pmQaCount = liveCalc.assignedPeople.filter(
    (p) => p.roleGroup === "pm_qa"
  ).length;
  const leadCount = liveCalc.assignedPeople.filter(
    (p) => p.roleGroup === "leadership"
  ).length;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PresetSelector
        selectedPreset={selectedPreset}
        onSelect={handlePresetSelect}
        presets={presets}
      />

      <ProjectDetails
        projectName={projectName}
        clientName={clientName}
        durationValue={durationValue}
        durationUnit={durationUnit}
        onProjectNameChange={setProjectName}
        onClientNameChange={setClientName}
        onDurationChange={handleProjectDurationChange}
      />

      <TeamSquad
        employees={employees}
        currency={currency}
        durationValue={durationValue}
        durationUnit={durationUnit}
        allocations={allocations}
        groupDurations={groupDurations}
        assignedPeople={liveCalc.assignedPeople}
        unassignedEmployees={unassignedEmployees}
        devCount={devCount}
        designCount={designCount}
        pmQaCount={pmQaCount}
        leadCount={leadCount}
        devHours={liveCalc.devHours}
        designHours={liveCalc.designHours}
        pmQaHours={liveCalc.pmQaHours}
        leadershipHours={liveCalc.leadershipHours}
        onAddMember={addIndividualMember}
        onRemoveMember={removeIndividualMember}
        onUpdateAllocation={updateIndividualAllocation}
        onGroupDurationChange={handleGroupDurationChange}
        onGroupSyncProject={handleGroupSyncProject}
        onGroupIncrementDays={handleGroupIncrementDays}
        onGroupPercentAdjust={handleGroupPercentAdjust}
        onIndividualIncrementDays={handleIndividualIncrementDays}
      />

      <CostSummaryPanel
        currency={currency}
        marginPct={marginPct}
        salesCommissionPct={salesCommissionPct}
        durationValue={durationValue}
        durationUnit={durationUnit}
        totalHours={liveCalc.totalHours}
        pricePerHour={liveCalc.pricePerHour}
        pricePerDay={liveCalc.pricePerDay}
        pricePerWeek={liveCalc.pricePerWeek}
        pricePerMonth={liveCalc.pricePerMonth}
        costPerHour={liveCalc.costPerHour}
        costPerDay={liveCalc.costPerDay}
        costPerWeek={liveCalc.costPerWeek}
        costPerMonth={liveCalc.costPerMonth}
        price={liveCalc.price}
        totalCost={liveCalc.totalCost}
        commission={liveCalc.commission}
        netProfit={liveCalc.netProfit}
        onApply={handleApply}
      />
    </div>
  );
});
