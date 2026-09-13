import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import {
  SettingsPageHeader,
  SettingsReadOnlyNotice,
} from "@/components/settings/SettingsPageHeader";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { logActivity, useInvalidate, type WorkspaceData } from "@/lib/workspace";
import { MAX_MARGIN_PCT } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/settings/policy")({
  head: () => ({
    meta: [
      { title: "Cost & pricing policy — CostCraft" },
      {
        name: "description",
        content: "Configure working hours, utilization, contingency, margin and pricing defaults.",
      },
    ],
  }),
  component: () => <WorkspaceGate>{(ws) => <PolicyPage workspace={ws} />}</WorkspaceGate>,
});

function PolicyPage({ workspace }: { workspace: WorkspaceData }) {
  const companyId = workspace.company!.id;
  const invalidate = useInvalidate();
  const [policy, setPolicy] = useState(workspace.policy);
  const readOnly = !workspace.canManageCosts;

  useEffect(() => setPolicy(workspace.policy), [workspace.policy]);

  const savePolicy = async () => {
    if (!policy) return;
    const checks: [string, number, number, number][] = [
      ["Working days per year", Number(policy.working_days_per_year), 1, 366],
      ["Hours per working day", Number(policy.hours_per_day), 1, 24],
      ["Default utilization %", Number(policy.default_utilization_pct), 1, 100],
      ["Default contingency %", Number(policy.default_contingency_pct), 0, 100],
      ["Target margin %", Number(policy.default_margin_pct), 0, MAX_MARGIN_PCT],
      ["Markup %", Number(policy.default_markup_pct), 0, 1000],
      ["Rounding step", Number(policy.rounding_step), 0, 1_000_000],
    ];
    for (const [label, value, min, max] of checks) {
      if (!Number.isFinite(value) || value < min || value > max) {
        toast.error(`${label} must be between ${min} and ${max}.`);
        return;
      }
    }

    const { error } = await supabase
      .from("cost_policies")
      .update({
        working_days_per_year: policy.working_days_per_year,
        hours_per_day: policy.hours_per_day,
        default_utilization_pct: policy.default_utilization_pct,
        default_contingency_pct: policy.default_contingency_pct,
        default_margin_pct: policy.default_margin_pct,
        default_markup_pct: policy.default_markup_pct,
        pricing_mode: policy.pricing_mode,
        rounding_step: policy.rounding_step,
      })
      .eq("company_id", companyId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity(companyId, "updated", "cost_policy", null, {});
    invalidate(["workspace"]);
    toast.success("Cost policy saved");
  };

  return (
    <>
      <SettingsPageHeader
        title="Cost & pricing policy"
        description="Set the working-time and pricing defaults used by every new estimate."
      />
      {readOnly && <SettingsReadOnlyNotice />}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">How costs turn into prices</CardTitle>
          <CardDescription>
            Fewer billable hours means a higher hourly cost. Contingency covers risk; margin is the
            profit you want to keep.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {policy && (
            <>
              <Field label="Working days per year">
                <Input
                  type="number"
                  disabled={readOnly}
                  value={policy.working_days_per_year}
                  onChange={(event) =>
                    setPolicy({ ...policy, working_days_per_year: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label="Hours per working day">
                <Input
                  type="number"
                  disabled={readOnly}
                  value={policy.hours_per_day}
                  onChange={(event) =>
                    setPolicy({ ...policy, hours_per_day: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label="Default utilization %" hint="Used when a person has no target set">
                <Input
                  type="number"
                  disabled={readOnly}
                  value={policy.default_utilization_pct}
                  onChange={(event) =>
                    setPolicy({ ...policy, default_utilization_pct: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label="Default contingency %">
                <Input
                  type="number"
                  disabled={readOnly}
                  value={policy.default_contingency_pct}
                  onChange={(event) =>
                    setPolicy({ ...policy, default_contingency_pct: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label="Pricing approach">
                <Select
                  disabled={readOnly}
                  value={policy.pricing_mode}
                  onValueChange={(value) => setPolicy({ ...policy, pricing_mode: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="margin">Target margin (% of price)</SelectItem>
                    <SelectItem value="markup">Markup (% added to cost)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Rounding step" hint="Prices round to the nearest step">
                <Input
                  type="number"
                  disabled={readOnly}
                  value={policy.rounding_step}
                  onChange={(event) =>
                    setPolicy({ ...policy, rounding_step: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label="Default target margin %">
                <Input
                  type="number"
                  disabled={readOnly}
                  value={policy.default_margin_pct}
                  onChange={(event) =>
                    setPolicy({ ...policy, default_margin_pct: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label="Default markup %">
                <Input
                  type="number"
                  disabled={readOnly}
                  value={policy.default_markup_pct}
                  onChange={(event) =>
                    setPolicy({ ...policy, default_markup_pct: Number(event.target.value) })
                  }
                />
              </Field>
              {!readOnly && (
                <div className="sm:col-span-2">
                  <Button onClick={savePolicy}>Save policy</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
