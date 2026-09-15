import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import {
  SettingsPageHeader,
  SettingsReadOnlyNotice,
} from "@/components/settings/SettingsPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SALES_STAGES, normalizedStages, type SalesProcessStage } from "@/lib/sales";
import { logActivity, useInvalidate, type WorkspaceData } from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/settings/sales-process")({
  head: () => ({ meta: [{ title: "Sales process — CostCraft" }] }),
  component: () => (
    <WorkspaceGate>{(workspace) => <SalesProcessPage workspace={workspace} />}</WorkspaceGate>
  ),
});

function SalesProcessPage({ workspace }: { workspace: WorkspaceData }) {
  const companyId = workspace.company!.id;
  const canEdit = workspace.canEdit;
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  const { data: storedStages = [] } = useStages(companyId);
  const stages = useMemo(
    () =>
      storedStages.length > 0
        ? normalizedStages(storedStages)
        : DEFAULT_SALES_STAGES.map((stage, index) => ({
            ...stage,
            id: `default-${index}`,
            company_id: companyId,
            sort_order: index,
            active: true,
          })),
    [companyId, storedStages],
  );

  const write = async (action: () => Promise<{ error: { message: string } | null }>) => {
    setBusy(true);
    try {
      const result = await action();
      if (result.error) throw new Error(result.error.message);
      invalidate(["sales-process-stages"]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save sales process");
    } finally {
      setBusy(false);
    }
  };

  const saveDefaults = () =>
    write(async () => {
      const result = await supabase.from("sales_process_stages").insert(
        DEFAULT_SALES_STAGES.map((stage, sort_order) => ({
          company_id: companyId,
          sort_order,
          ...stage,
        })) as never,
      );
      if (!result.error) await logActivity(companyId, "created", "sales_process", null, {});
      return result as { error: { message: string } | null };
    });

  const addStage = () =>
    write(async () => {
      const result = await supabase.from("sales_process_stages").insert({
        company_id: companyId,
        name: "New stage",
        sort_order: stages.length,
        probability_pct: 25,
        color: "blue",
      } as never);
      return result as { error: { message: string } | null };
    });

  const patch = (stage: SalesProcessStage, changes: Record<string, unknown>) => {
    if (stage.id.startsWith("default-")) return;
    void write(async () => {
      const result = await supabase
        .from("sales_process_stages")
        .update(changes as never)
        .eq("id", stage.id);
      return result as { error: { message: string } | null };
    });
  };

  const remove = (stage: SalesProcessStage) => {
    if (stage.id.startsWith("default-")) return;
    if (
      !confirm(
        `Delete the ${stage.name} stage? Leads already using it will keep their stage label.`,
      )
    )
      return;
    void write(async () => {
      const result = await supabase.from("sales_process_stages").delete().eq("id", stage.id);
      return result as { error: { message: string } | null };
    });
  };

  return (
    <>
      <SettingsPageHeader
        title="Sales process"
        description="Define the stages and probabilities used by your sales pipeline."
      />
      {!canEdit && <SettingsReadOnlyNotice />}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="font-display text-base">Pipeline stages</CardTitle>
              <CardDescription>
                Probability is used for weighted pipeline value and forecasting.
              </CardDescription>
            </div>
            {canEdit && (
              <div className="flex gap-2">
                {storedStages.length === 0 && (
                  <Button variant="outline" disabled={busy} onClick={() => void saveDefaults()}>
                    Save defaults
                  </Button>
                )}
                <Button
                  disabled={busy || storedStages.length === 0}
                  onClick={() => void addStage()}
                >
                  <Plus className="size-4" /> Add stage
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {storedStages.length === 0 && (
            <p className="rounded-md border border-accent bg-accent/15 px-3 py-2 text-sm">
              These starter stages are ready to use. Save them to customize your process and make
              them available across the CRM.
            </p>
          )}
          {stages.map((stage, index) => (
            <div
              key={stage.id}
              className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[auto_2fr_1fr_1fr_auto] sm:items-center"
            >
              <span className="text-xs tabular-nums text-muted-foreground">{index + 1}</span>
              <Input
                aria-label={`Stage ${index + 1} name`}
                disabled={!canEdit || stage.id.startsWith("default-")}
                defaultValue={stage.name}
                onBlur={(event) => patch(stage, { name: event.target.value.trim() || stage.name })}
              />
              <Input
                aria-label={`Probability for ${stage.name}`}
                type="number"
                min={0}
                max={100}
                disabled={!canEdit || stage.id.startsWith("default-")}
                defaultValue={stage.probability_pct}
                onBlur={(event) =>
                  patch(stage, {
                    probability_pct: Math.min(Math.max(Number(event.target.value) || 0, 0), 100),
                  })
                }
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    disabled={!canEdit || stage.id.startsWith("default-")}
                    checked={stage.is_won}
                    onChange={(event) => patch(stage, { is_won: event.target.checked })}
                  />{" "}
                  Won
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    disabled={!canEdit || stage.id.startsWith("default-")}
                    checked={stage.is_lost}
                    onChange={(event) => patch(stage, { is_lost: event.target.checked })}
                  />{" "}
                  Lost
                </label>
              </div>
              {canEdit && !stage.id.startsWith("default-") && (
                <Button variant="ghost" size="icon" onClick={() => remove(stage)}>
                  <Trash2 className="size-4" />
                  <span className="sr-only">Delete {stage.name}</span>
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function useStages(companyId: string) {
  return useQuery<SalesProcessStage[]>({
    queryKey: ["sales-process-stages", companyId],
    queryFn: async () => {
      const result = await supabase
        .from("sales_process_stages")
        .select("*")
        .eq("company_id", companyId)
        .order("sort_order");
      if (result.error) throw result.error;
      return (result.data ?? []) as SalesProcessStage[];
    },
  });
}
