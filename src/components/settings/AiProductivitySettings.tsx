import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logActivity, useAiFactors, useInvalidate } from "@/lib/workspace";
import {
  ACTIVITY_CATALOG,
  defaultAiFactors,
  resolveAiFactors,
  type ActivityKind,
} from "@/lib/ai-productivity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PHASE_LABEL: Record<string, string> = {
  discovery: "Discovery",
  design: "Design",
  build: "Build",
  qa: "QA & documentation",
  launch: "Launch",
};

interface Props {
  companyId: string;
  readOnly: boolean;
}

export function AiProductivitySettings({ companyId, readOnly }: Props) {
  const { data: stored } = useAiFactors(companyId);
  const invalidate = useInvalidate();
  const [values, setValues] = useState<Record<ActivityKind, number>>(defaultAiFactors);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValues(resolveAiFactors(stored as Record<ActivityKind, number> | undefined));
  }, [stored]);

  const grouped = useMemo(() => {
    const byPhase = new Map<string, typeof ACTIVITY_CATALOG>();
    for (const activity of ACTIVITY_CATALOG) {
      const list = byPhase.get(activity.phase) ?? [];
      list.push(activity);
      byPhase.set(activity.phase, list);
    }
    return [...byPhase.entries()];
  }, []);

  // A blended headline only makes sense as an unweighted average of the matrix; the
  // real reduction depends on an estimate's mix of activities.
  const averageReduction =
    ACTIVITY_CATALOG.reduce((sum, a) => sum + (values[a.kind] ?? 0), 0) / ACTIVITY_CATALOG.length;

  const save = async () => {
    setSaving(true);
    try {
      const rows = ACTIVITY_CATALOG.map((a) => ({
        company_id: companyId,
        activity_kind: a.kind,
        reduction_pct: Math.min(Math.max(Number(values[a.kind]) || 0, 0), 90),
      }));
      // The table is newer than the generated Supabase types.
      const { error } = await (
        supabase.from("ai_productivity_factors") as unknown as {
          upsert: (
            rows: unknown,
            options: { onConflict: string },
          ) => Promise<{ error: { message: string } | null }>;
        }
      ).upsert(rows, { onConflict: "company_id,activity_kind" });
      if (error) throw error;
      await logActivity(companyId, "updated", "ai_productivity_factors", null, {});
      invalidate(["ai-factors"]);
      toast.success("AI productivity factors saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save factors");
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => setValues(defaultAiFactors());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">AI productivity factors</CardTitle>
        <CardDescription>
          How much effort AI removes from each activity. These reduce estimated hours before
          costing, so they change every quote. Work that needs human judgement, accountability or
          someone else&apos;s calendar — approvals, security sign-off, UAT, deployment — defaults to
          no reduction, and normally should stay there.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Average across all activities:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {averageReduction.toFixed(0)}%
          </span>{" "}
          — the reduction an individual estimate sees depends on its mix of work.
        </p>

        {grouped.map(([phase, activities]) => (
          <fieldset key={phase} className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {PHASE_LABEL[phase] ?? phase}
            </legend>
            <div className="space-y-2">
              {activities.map((activity) => {
                const inputId = `ai-factor-${activity.kind}`;
                const isDefault = values[activity.kind] === activity.defaultReductionPct;
                return (
                  <div
                    key={activity.kind}
                    className="grid items-start gap-3 rounded-md border p-3 sm:grid-cols-[1fr_auto]"
                  >
                    <div className="min-w-0">
                      <label htmlFor={inputId} className="text-sm font-medium">
                        {activity.label}
                      </label>
                      <p id={`${inputId}-hint`} className="mt-0.5 text-xs text-muted-foreground">
                        {activity.rationale}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isDefault && (
                        <Badge variant="secondary" className="text-[10px]">
                          Changed
                        </Badge>
                      )}
                      <Input
                        id={inputId}
                        type="number"
                        min={0}
                        max={90}
                        step={5}
                        disabled={readOnly}
                        aria-describedby={`${inputId}-hint`}
                        className="w-24 tabular-nums"
                        value={values[activity.kind] ?? 0}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [activity.kind]: Number(e.target.value),
                          }))
                        }
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}

        {!readOnly && (
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button onClick={save} disabled={saving} className="gap-2">
              <Save className="size-4" aria-hidden="true" />
              {saving ? "Saving..." : "Save factors"}
            </Button>
            <Button variant="outline" onClick={resetToDefaults} className="gap-2">
              <RotateCcw className="size-4" aria-hidden="true" />
              Reset to defaults
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
