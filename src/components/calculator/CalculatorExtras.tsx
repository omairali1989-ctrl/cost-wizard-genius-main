import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LineItem, TechItem } from "@/lib/pricing";

interface CalculatorExtrasProps {
  additionalWork: LineItem[];
  technology: TechItem[];
  onAddAdditionalWork: () => void;
  onUpdateAdditionalWork: (id: string, patch: Partial<LineItem>) => void;
  onRemoveAdditionalWork: (id: string) => void;
  onAddTechnology: () => void;
  onUpdateTechnology: (id: string, patch: Partial<TechItem>) => void;
  onRemoveTechnology: (id: string) => void;
}

export const CalculatorExtras = React.memo(function CalculatorExtras({
  additionalWork,
  technology,
  onAddAdditionalWork,
  onUpdateAdditionalWork,
  onRemoveAdditionalWork,
  onAddTechnology,
  onUpdateTechnology,
  onRemoveTechnology,
}: CalculatorExtrasProps) {
  return (
    <div className="space-y-5 pb-4">
      {/* Additional Work */}
      <div className="rounded-md border p-3">
        <p className="mb-2 text-sm font-medium">Additional work</p>
        <div className="space-y-2">
          {additionalWork.map((i) => (
            <div key={i.id} className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
              <Input
                placeholder="Description"
                value={i.label}
                onChange={(e) => onUpdateAdditionalWork(i.id, { label: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Amount"
                value={i.amount || ""}
                onChange={(e) => onUpdateAdditionalWork(i.id, { amount: Number(e.target.value) })}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemoveAdditionalWork(i.id)}
                aria-label="Delete additional work"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={onAddAdditionalWork}>
            <Plus className="size-4" /> Add item
          </Button>
        </div>
      </div>

      {/* Technology & Licences */}
      <div className="rounded-md border p-3">
        <p className="mb-2 text-sm font-medium">Technology & licences</p>
        <div className="space-y-2">
          {technology.map((t) => (
            <div key={t.id} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
              <Input
                placeholder="Tool or service"
                value={t.label}
                onChange={(e) => onUpdateTechnology(t.id, { label: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Monthly"
                value={t.monthlyCost || ""}
                onChange={(e) => onUpdateTechnology(t.id, { monthlyCost: Number(e.target.value) })}
              />
              <Input
                type="number"
                placeholder="Months"
                value={t.months || ""}
                onChange={(e) => onUpdateTechnology(t.id, { months: Number(e.target.value) })}
              />
              <Input
                type="number"
                placeholder="One-off"
                value={t.oneOffCost || ""}
                onChange={(e) => onUpdateTechnology(t.id, { oneOffCost: Number(e.target.value) })}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemoveTechnology(t.id)}
                aria-label="Delete technology item"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={onAddTechnology}>
            <Plus className="size-4" /> Add technology
          </Button>
        </div>
      </div>
    </div>
  );
});
