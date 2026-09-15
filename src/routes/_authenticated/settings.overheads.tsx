import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import {
  SettingsPageHeader,
  SettingsReadOnlyNotice,
} from "@/components/settings/SettingsPageHeader";
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
import { logActivity, useInvalidate, useOverheads, type WorkspaceData } from "@/lib/workspace";
import {
  formatMoney,
  monthlyOverheadAmount,
  overheadClassificationLabel,
  OVERHEAD_CLASSIFICATIONS,
} from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/settings/overheads")({
  head: () => ({
    meta: [
      { title: "Overheads — CostCraft" },
      {
        name: "description",
        content: "Manage recurring company overheads used in cost estimates.",
      },
    ],
  }),
  component: () => <WorkspaceGate>{(ws) => <OverheadsPage workspace={ws} />}</WorkspaceGate>,
});

function OverheadsPage({ workspace }: { workspace: WorkspaceData }) {
  const companyId = workspace.company!.id;
  const currency = workspace.company!.currency;
  const invalidate = useInvalidate();
  const { data: overheads = [] } = useOverheads(companyId);
  const readOnly = !workspace.canManageCosts;
  const monthlyTotal = overheads.reduce(
    (sum, overhead) => sum + monthlyOverheadAmount(overhead),
    0,
  );
  const totalsByClassification = OVERHEAD_CLASSIFICATIONS.map((classification) => ({
    ...classification,
    amount: overheads
      .filter((overhead) => (overhead.category ?? "other") === classification.value)
      .reduce((sum, overhead) => sum + monthlyOverheadAmount(overhead), 0),
  })).filter((classification) => classification.amount > 0);

  const addOverhead = async () => {
    const { error } = await supabase
      .from("overheads")
      .insert({ company_id: companyId, name: "New overhead", monthly_amount: 0 });
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity(companyId, "created", "overhead", null, { classification: "other" });
    invalidate(["overheads"]);
  };

  const updateOverhead = async (id: string, patch: Record<string, unknown>) => {
    const safePatch = { ...patch };
    if ("monthly_amount" in safePatch) {
      const amount = Number(safePatch["monthly_amount"]);
      if (!Number.isFinite(amount) || amount < 0) {
        toast.error("Overhead amount must be zero or greater.");
        return;
      }
      safePatch["monthly_amount"] = amount;
    }
    const { error } = await supabase
      .from("overheads")
      .update(safePatch as never)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate(["overheads"]);
  };

  const removeOverhead = async (id: string) => {
    const { error } = await supabase.from("overheads").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity(companyId, "deleted", "overhead", id, {});
    invalidate(["overheads"]);
  };

  return (
    <>
      <SettingsPageHeader
        title="Overheads"
        description="Manage recurring operating costs shared across active people."
      />
      {readOnly && <SettingsReadOnlyNotice />}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Overheads</CardTitle>
          <CardDescription>
            Total {formatMoney(monthlyTotal, currency)} per month, shared evenly across active
            people.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {totalsByClassification.length > 0 && (
            <div className="mb-5 grid gap-2 border-b pb-5 sm:grid-cols-2 lg:grid-cols-4">
              {totalsByClassification.map((classification) => (
                <div key={classification.value} className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">{classification.label}</p>
                  <p className="mt-1 font-display text-base font-semibold tabular-nums">
                    {formatMoney(classification.amount, currency)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">/ month</span>
                  </p>
                </div>
              ))}
            </div>
          )}
          {overheads.map((overhead) => (
            <div key={overhead.id} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
              <Input
                aria-label="Overhead name"
                disabled={readOnly}
                defaultValue={overhead.name}
                onBlur={(event) => updateOverhead(overhead.id, { name: event.target.value })}
              />
              <Select
                disabled={readOnly}
                value={overhead.category ?? "other"}
                onValueChange={(category) => updateOverhead(overhead.id, { category })}
              >
                <SelectTrigger aria-label={`Classification for ${overhead.name}`}>
                  <SelectValue placeholder="Classification" />
                </SelectTrigger>
                <SelectContent>
                  {overhead.category &&
                    !OVERHEAD_CLASSIFICATIONS.some(
                      (classification) => classification.value === overhead.category,
                    ) && (
                      <SelectItem value={overhead.category}>
                        {overheadClassificationLabel(overhead.category)}
                      </SelectItem>
                    )}
                  {OVERHEAD_CLASSIFICATIONS.map((classification) => (
                    <SelectItem key={classification.value} value={classification.value}>
                      {classification.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                aria-label="Overhead amount"
                disabled={readOnly}
                type="number"
                defaultValue={Number(overhead.monthly_amount)}
                onBlur={(event) =>
                  updateOverhead(overhead.id, { monthly_amount: Number(event.target.value) })
                }
              />
              <Select
                disabled={readOnly}
                value={overhead.period ?? "monthly"}
                onValueChange={(period) => updateOverhead(overhead.id, { period })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Per month</SelectItem>
                  <SelectItem value="yearly">Per year</SelectItem>
                </SelectContent>
              </Select>
              {!readOnly && (
                <Button variant="ghost" size="icon" onClick={() => removeOverhead(overhead.id)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  <span className="sr-only">Remove overhead {overhead.name}</span>
                </Button>
              )}
            </div>
          ))}
          {!readOnly && (
            <Button variant="outline" onClick={addOverhead}>
              <Plus className="size-4" /> Add overhead
            </Button>
          )}
        </CardContent>
      </Card>
    </>
  );
}
