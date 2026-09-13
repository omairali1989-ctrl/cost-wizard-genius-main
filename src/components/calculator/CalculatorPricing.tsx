import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CalculationInputs } from "@/lib/pricing";

interface CalculatorPricingProps {
  contingencyPct: number;
  pricingMode: CalculationInputs["pricingMode"];
  marginPct: number;
  markupPct: number;
  discountPct?: number;
  salesCommissionPct?: number;
  notes: string;
  onChange: (patch: Partial<CalculationInputs>) => void;
}

export const CalculatorPricing = React.memo(function CalculatorPricing({
  contingencyPct,
  pricingMode,
  marginPct,
  markupPct,
  discountPct,
  salesCommissionPct = 5,
  notes,
  onChange,
}: CalculatorPricingProps) {
  return (
    <div className="grid gap-4 pb-4 sm:grid-cols-2">
      <Field label="Contingency %" hint="Buffer for the unexpected">
        <Input
          type="number"
          value={contingencyPct || ""}
          onChange={(e) => onChange({ contingencyPct: Number(e.target.value) })}
        />
      </Field>
      <Field label="Pricing approach">
        <Select
          value={pricingMode}
          onValueChange={(v) => onChange({ pricingMode: v as "margin" | "markup" })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="margin">Target margin</SelectItem>
            <SelectItem value="markup">Markup on cost</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {pricingMode === "margin" ? (
        <Field label="Target margin %">
          <Input
            type="number"
            value={marginPct || ""}
            onChange={(e) => onChange({ marginPct: Number(e.target.value) })}
          />
        </Field>
      ) : (
        <Field label="Markup %">
          <Input
            type="number"
            value={markupPct || ""}
            onChange={(e) => onChange({ markupPct: Number(e.target.value) })}
          />
        </Field>
      )}
      <Field label="Discount %">
        <Input
          type="number"
          value={discountPct || ""}
          onChange={(e) => onChange({ discountPct: Number(e.target.value) })}
        />
      </Field>
      <Field label="Sales Commission %" hint="Paid to the sales owner of this deal">
        <Input
          type="number"
          placeholder="5"
          value={salesCommissionPct || ""}
          onChange={(e) => onChange({ salesCommissionPct: Number(e.target.value) })}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Notes for the proposal">
          <Textarea rows={3} value={notes} onChange={(e) => onChange({ notes: e.target.value })} />
        </Field>
      </div>
    </div>
  );
});
