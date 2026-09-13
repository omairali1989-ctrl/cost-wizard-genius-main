import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AllocationRow, type TeamMemberRate } from "./AllocationRow";
import { formatMoney, type Allocation, type Phase } from "@/lib/pricing";

interface PhaseCardProps {
  phase: Phase;
  employees: TeamMemberRate[];
  rateFor: (id: string) => number;
  currency?: string;
  hoursPerDay?: number;
  hoursPerMonth?: number;
  onUpdatePhaseName: (phaseId: string, name: string) => void;
  onRemovePhase: (phaseId: string) => void;
  onAddAllocation: (phaseId: string) => void;
  onUpdateAllocation: (phaseId: string, allocId: string, patch: Partial<Allocation>) => void;
  onRemoveAllocation: (phaseId: string, allocId: string) => void;
}

export const PhaseCard = React.memo(function PhaseCard({
  phase,
  employees,
  rateFor,
  currency = "PKR",
  hoursPerDay = 8,
  hoursPerMonth = 160,
  onUpdatePhaseName,
  onRemovePhase,
  onAddAllocation,
  onUpdateAllocation,
  onRemoveAllocation,
}: PhaseCardProps) {
  const totalHours = React.useMemo(
    () => phase.allocations.reduce((s, a) => s + Math.max(Number(a.hours) || 0, 0), 0),
    [phase.allocations],
  );

  const totalCost = React.useMemo(
    () =>
      phase.allocations.reduce(
        (s, a) => s + Math.max(Number(a.hours) || 0, 0) * Math.max(Number(a.hourlyCost) || 0, 0),
        0,
      ),
    [phase.allocations],
  );

  const durationDays = React.useMemo(() => {
    return Math.round((totalHours / Math.max(hoursPerDay, 1)) * 10) / 10;
  }, [totalHours, hoursPerDay]);

  return (
    <div className="rounded-xl border bg-card/60 p-3.5 shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Input
            className="max-w-xs font-semibold text-sm h-8"
            aria-label="Phase name"
            value={phase.name}
            onChange={(e) => onUpdatePhaseName(phase.id, e.target.value)}
            placeholder="Phase Name (e.g., UI/UX Design)"
          />
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-xs py-1 px-2.5 gap-1.5">
            <span className="font-semibold text-foreground">{totalHours} hrs</span>
            <span className="text-muted-foreground/60">•</span>
            <span className="text-primary font-bold">{formatMoney(totalCost, currency)}</span>
            {durationDays > 0 && (
              <>
                <span className="text-muted-foreground/60">•</span>
                <span className="text-muted-foreground">~{durationDays}d</span>
              </>
            )}
          </Badge>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemovePhase(phase.id)}
            aria-label="Delete phase"
            className="size-8 text-muted-foreground hover:text-destructive shrink-0"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {phase.allocations.length === 0 ? (
          <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
            No team members allocated to this phase yet. Click below to add.
          </div>
        ) : (
          phase.allocations.map((a) => (
            <AllocationRow
              key={a.id}
              phaseId={phase.id}
              allocation={a}
              employees={employees}
              rateFor={rateFor}
              currency={currency}
              hoursPerDay={hoursPerDay}
              hoursPerMonth={hoursPerMonth}
              onUpdate={onUpdateAllocation}
              onRemove={onRemoveAllocation}
            />
          ))
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onAddAllocation(phase.id)}
          className="text-xs h-8 gap-1.5"
        >
          <Plus className="size-3.5" /> Add Team Member / Role
        </Button>
      </div>
    </div>
  );
});
