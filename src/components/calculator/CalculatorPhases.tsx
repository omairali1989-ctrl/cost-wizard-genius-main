import * as React from "react";
import {
  Plus,
  Palette,
  Code2,
  Database,
  Smartphone,
  CheckCircle2,
  Rocket,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PhaseCard } from "./PhaseCard";
import type { TeamMemberRate } from "./AllocationRow";
import type { Allocation, Phase } from "@/lib/pricing";
import { matchEmployeeForRole } from "@/lib/role-matching";

interface CalculatorPhasesProps {
  phases: Phase[];
  employees: TeamMemberRate[];
  rateFor: (id: string) => number;
  currency?: string;
  hoursPerDay?: number;
  hoursPerMonth?: number;
  onAddPhase: () => void;
  onAddPhaseTemplate?: (phase: Phase) => void;
  onRemovePhase: (phaseId: string) => void;
  onUpdatePhaseName: (phaseId: string, name: string) => void;
  onAddAllocation: (phaseId: string) => void;
  onUpdateAllocation: (phaseId: string, allocId: string, patch: Partial<Allocation>) => void;
  onRemoveAllocation: (phaseId: string, allocId: string) => void;
}

export const CalculatorPhases = React.memo(function CalculatorPhases({
  phases,
  employees,
  rateFor,
  currency = "PKR",
  hoursPerDay = 8,
  hoursPerMonth = 160,
  onAddPhase,
  onAddPhaseTemplate,
  onRemovePhase,
  onUpdatePhaseName,
  onAddAllocation,
  onUpdateAllocation,
  onRemoveAllocation,
}: CalculatorPhasesProps) {
  const totalPhaseHours = React.useMemo(() => {
    return phases.reduce(
      (sum, p) => sum + p.allocations.reduce((s, a) => s + Math.max(Number(a.hours) || 0, 0), 0),
      0,
    );
  }, [phases]);

  // Resolve a role to whoever in THIS workspace fills it. The previous version fell
  // back to specific people's names, which matched nobody in any other workspace.
  const findEmp = React.useCallback(
    (role: string) => matchEmployeeForRole(role, employees) ?? null,
    [employees],
  );

  const handleAddTemplate = React.useCallback(
    (type: "ui" | "frontend" | "backend" | "mobile" | "qa" | "devops") => {
      let name = "New Phase";
      let roleLabel = "Specialist";
      let emp = null;
      let hours = 40;

      switch (type) {
        case "ui":
          name = "UI/UX & Interactive Prototyping";
          emp = findEmp("designer");
          roleLabel = emp?.job_title ?? "UI/UX Designer";
          hours = 40;
          break;
        case "frontend":
          name = "Frontend Web Development";
          emp = findEmp("frontend");
          roleLabel = emp?.job_title ?? "Frontend Engineer";
          hours = 60;
          break;
        case "backend":
          name = "Backend & Database Engine";
          emp = findEmp("backend");
          roleLabel = emp?.job_title ?? "Backend Engineer";
          hours = 60;
          break;
        case "mobile":
          name = "Mobile App Development";
          emp = findEmp("mobile");
          roleLabel = emp?.job_title ?? "Mobile Developer";
          hours = 60;
          break;
        case "qa":
          name = "QA & Integration Testing";
          emp = findEmp("qa");
          roleLabel = emp?.job_title ?? "QA Engineer";
          hours = 24;
          break;
        case "devops":
          name = "DevOps, CI/CD & Cloud Launch";
          emp = findEmp("devops") || findEmp("tech lead");
          roleLabel = emp?.job_title ?? "DevOps & Cloud Lead";
          hours = 16;
          break;
      }

      const newPhase: Phase = {
        id: crypto.randomUUID(),
        name,
        allocations: [
          {
            id: crypto.randomUUID(),
            employeeId: emp?.id ?? null,
            label: roleLabel,
            hours,
            hourlyCost: emp ? rateFor(emp.id) : 1000,
          },
        ],
      };

      if (onAddPhaseTemplate) {
        onAddPhaseTemplate(newPhase);
      } else {
        onAddPhase();
      }
    },
    [findEmp, rateFor, onAddPhaseTemplate, onAddPhase],
  );

  return (
    <Card className="border shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <span>2. Project Delivery Phases & Team Hours</span>
            </CardTitle>
            <CardDescription>
              Assign team members to specific development phases. Loaded hourly costs automatically
              include absorbed overheads.
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-xs px-2.5 py-1">
            {phases.length} {phases.length === 1 ? "phase" : "phases"} · {totalPhaseHours} hrs
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Quick Add Phase Templates Bar */}
        <div className="rounded-lg border bg-muted/40 p-2.5 space-y-1.5">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Quick-Add Standard Lifecycle Phase:
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleAddTemplate("ui")}
              className="h-7 text-xs gap-1 px-2 hover:bg-muted hover:text-foreground dark:hover:text-muted-foreground"
            >
              <Palette className="size-3 text-foreground" />
              <span>+ UI/UX Design</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleAddTemplate("frontend")}
              className="h-7 text-xs gap-1 px-2 hover:bg-muted hover:text-foreground dark:hover:text-muted-foreground"
            >
              <Code2 className="size-3 text-foreground" />
              <span>+ Frontend Web</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleAddTemplate("backend")}
              className="h-7 text-xs gap-1 px-2 hover:bg-muted hover:text-foreground dark:hover:text-muted-foreground"
            >
              <Database className="size-3 text-foreground" />
              <span>+ Backend & API</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleAddTemplate("mobile")}
              className="h-7 text-xs gap-1 px-2 hover:bg-muted hover:text-foreground dark:hover:text-muted-foreground"
            >
              <Smartphone className="size-3 text-foreground" />
              <span>+ Mobile App</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleAddTemplate("qa")}
              className="h-7 text-xs gap-1 px-2 hover:bg-muted hover:text-foreground dark:hover:text-muted-foreground"
            >
              <CheckCircle2 className="size-3 text-foreground" />
              <span>+ QA & Testing</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleAddTemplate("devops")}
              className="h-7 text-xs gap-1 px-2 hover:bg-warning/15 hover:text-warning dark:hover:text-warning"
            >
              <Rocket className="size-3 text-warning" />
              <span>+ DevOps & Cloud</span>
            </Button>
          </div>
        </div>

        {/* Phase Cards */}
        <div className="space-y-4">
          {phases.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No phases defined yet. Click any of the quick-add buttons above or "+ Blank Phase"
              below.
            </div>
          ) : (
            phases.map((phase) => (
              <PhaseCard
                key={phase.id}
                phase={phase}
                employees={employees}
                rateFor={rateFor}
                currency={currency}
                hoursPerDay={hoursPerDay}
                hoursPerMonth={hoursPerMonth}
                onUpdatePhaseName={onUpdatePhaseName}
                onRemovePhase={onRemovePhase}
                onAddAllocation={onAddAllocation}
                onUpdateAllocation={onUpdateAllocation}
                onRemoveAllocation={onRemoveAllocation}
              />
            ))
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddPhase}
          className="h-9 gap-1.5 font-medium"
        >
          <Plus className="size-4" /> Add Blank Phase
        </Button>
      </CardContent>
    </Card>
  );
});
