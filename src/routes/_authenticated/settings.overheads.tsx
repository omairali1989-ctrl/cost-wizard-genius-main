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
import { formatMoney, monthlyOverheadAmount } from "@/lib/pricing";

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

  const addOverhead = async () => {
    const { error } = await supabase
      .from("overheads")
      .insert({ company_id: companyId, name: "New overhead", monthly_amount: 0 });
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate(["overheads"]);
  };

  const updateOverhead = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase
      .from("overheads")
      .update(patch as never)
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
          {overheads.map((overhead) => (
            <div key={overhead.id} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
              <Input
                aria-label="Overhead name"
                disabled={readOnly}
                defaultValue={overhead.name}
                onBlur={(event) => updateOverhead(overhead.id, { name: event.target.value })}
              />
              <Input
                aria-label="Category"
                disabled={readOnly}
                defaultValue={overhead.category ?? ""}
                placeholder="Category"
                onBlur={(event) =>
                  updateOverhead(overhead.id, { category: event.target.value || null })
                }
              />
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
