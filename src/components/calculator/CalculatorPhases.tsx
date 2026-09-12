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

interface CalculatorPhasesProps {
  phases: Phase[];
  employees: TeamMemberRate[];
  rateFor: (id: string) => number;
  currency?: string;
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
      (sum, p) => sum + p.allocations.reduce((s, a) => s + Number(a.hours || 0), 0),
      0,
    );
  }, [phases]);

  // Helper to find employee by keyword
  const findEmp = React.useCallback(
    (keyword: string) => {
      const kw = keyword.toLowerCase();
      return (
        employees.find(
          (e) =>
            (e.job_title || "").toLowerCase().includes(kw) ||
            e.name.toLowerCase().includes(kw) ||
            (e.department || "").toLowerCase().includes(kw),
        ) ?? null
      );
    },
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
          emp = findEmp("design") || findEmp("yousuf ansari") || findEmp("faiza");
          roleLabel = emp?.job_title ?? "UI/UX Designer";
          hours = 40;
          break;
        case "frontend":
          name = "Frontend Web Development";
          emp = findEmp("mern") || findEmp("hassnain") || findEmp("minhaj");
          roleLabel = emp?.job_title ?? "Frontend Engineer";
          hours = 60;
          break;
        case "backend":
          name = "Backend & Database Engine";
          emp = findEmp("laravel") || findEmp("osama") || findEmp("architect") || findEmp("yousuf");
          roleLabel = emp?.job_title ?? "Backend Engineer";
          hours = 60;
          break;
        case "mobile":
          name = "Mobile App Development";
          emp = findEmp("mobile") || findEmp("mubashir");
          roleLabel = emp?.job_title ?? "Mobile Developer";
          hours = 60;
          break;
        case "qa":
          name = "QA & Integration Testing";
          emp = findEmp("qa") || findEmp("quality") || findEmp("kamran");
          roleLabel = emp?.job_title ?? "QA Engineer";
          hours = 24;
          break;
        case "devops":
          name = "DevOps, CI/CD & Cloud Launch";
          emp = findEmp("architect") || findEmp("lead") || findEmp("yousuf");
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
              Assign team members to specific development phases. Loaded hourly costs automatically include absorbed overheads.
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
              className="h-7 text-xs gap-1 px-2 hover:bg-purple-500/15 hover:text-purple-700 dark:hover:text-purple-300"
            >
              <Palette className="size-3 text-purple-500" />
              <span>+ UI/UX Design</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleAddTemplate("frontend")}
              className="h-7 text-xs gap-1 px-2 hover:bg-blue-500/15 hover:text-blue-700 dark:hover:text-blue-300"
            >
              <Code2 className="size-3 text-blue-500" />
              <span>+ Frontend Web</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleAddTemplate("backend")}
              className="h-7 text-xs gap-1 px-2 hover:bg-indigo-500/15 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              <Database className="size-3 text-indigo-500" />
              <span>+ Backend & API</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleAddTemplate("mobile")}
              className="h-7 text-xs gap-1 px-2 hover:bg-sky-500/15 hover:text-sky-700 dark:hover:text-sky-300"
            >
              <Smartphone className="size-3 text-sky-500" />
              <span>+ Mobile App</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleAddTemplate("qa")}
              className="h-7 text-xs gap-1 px-2 hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-emerald-300"
            >
              <CheckCircle2 className="size-3 text-emerald-500" />
              <span>+ QA & Testing</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleAddTemplate("devops")}
              className="h-7 text-xs gap-1 px-2 hover:bg-amber-500/15 hover:text-amber-700 dark:hover:text-amber-300"
            >
              <Rocket className="size-3 text-amber-500" />
              <span>+ DevOps & Cloud</span>
            </Button>
          </div>
        </div>

        {/* Phase Cards */}
        <div className="space-y-4">
          {phases.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No phases defined yet. Click any of the quick-add buttons above or "+ Blank Phase" below.
            </div>
          ) : (
            phases.map((phase) => (
              <PhaseCard
                key={phase.id}
                phase={phase}
                employees={employees}
                rateFor={rateFor}
                currency={currency}
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
