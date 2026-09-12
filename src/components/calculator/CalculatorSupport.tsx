import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import type { CalculationInputs } from "@/lib/pricing";

interface CalculatorSupportProps {
  support: CalculationInputs["support"];
  onChange: (patch: Partial<CalculationInputs["support"]>) => void;
}

export const CalculatorSupport = React.memo(function CalculatorSupport({
  support,
  onChange,
}: CalculatorSupportProps) {
  return (
    <div className="rounded-md border p-3">
      <div className="mb-3 flex items-center gap-3">
        <Switch
          checked={support.enabled}
          onCheckedChange={(v) => onChange({ enabled: v })}
        />
        <Label>Include ongoing support</Label>
      </div>
      {support.enabled && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Months">
            <Input
              type="number"
              value={support.months || ""}
              onChange={(e) => onChange({ months: Number(e.target.value) })}
            />
          </Field>
          <Field label="Hours per month">
            <Input
              type="number"
              value={support.hoursPerMonth || ""}
              onChange={(e) => onChange({ hoursPerMonth: Number(e.target.value) })}
            />
          </Field>
          <Field label="Cost per hour">
            <Input
              type="number"
              value={support.hourlyCost || ""}
              onChange={(e) => onChange({ hourlyCost: Number(e.target.value) })}
            />
          </Field>
        </div>
      )}
    </div>
  );
});
