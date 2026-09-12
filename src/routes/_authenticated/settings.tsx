import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, BookOpen, Upload, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { PageHeader } from "@/components/AppShell";
import { Field } from "@/components/ui/field";
import { TeamSettings } from "@/components/TeamSettings";
import { FeatureLibraryManager } from "@/components/scope-engine/FeatureLibraryManager";
import { usePresetLibrary } from "@/components/calculator/qce/presetLibrary";
import { logActivity, useInvalidate, useOverheads, type WorkspaceData } from "@/lib/workspace";
import { formatMoney, monthlyOverheadAmount } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Company settings — CostCraft" },
      {
        name: "description",
        content: "Set working hours, utilization, overheads, contingency and target margin.",
      },
      { property: "og:title", content: "Company settings — CostCraft" },
      { property: "og:description", content: "Configure cost and pricing policy defaults." },
    ],
  }),
  component: () => <WorkspaceGate>{(ws) => <SettingsInner workspace={ws} />}</WorkspaceGate>,
});

function SettingsInner({ workspace }: { workspace: WorkspaceData }) {
  const companyId = workspace.company!.id;
  const currency = workspace.company!.currency;
  const invalidate = useInvalidate();
  const { data: overheads = [] } = useOverheads(companyId);
  const { presets, importPresets, deletePreset, resetPresets } = usePresetLibrary(companyId);

  const [company, setCompany] = useState({
    name: workspace.company!.name,
    industry: workspace.company!.industry ?? "",
    currency,
  });
  const [policy, setPolicy] = useState(workspace.policy);
  const [isLibraryManagerOpen, setIsLibraryManagerOpen] = useState(false);
  useEffect(() => setPolicy(workspace.policy), [workspace.policy]);

  const readOnly = !workspace.canManageCosts;

  const saveCompany = async () => {
    const { error } = await supabase
      .from("companies")
      .update({
        name: company.name,
        industry: company.industry || null,
        currency: company.currency,
      })
      .eq("id", companyId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity(companyId, "updated", "company", companyId, {});
    invalidate(["workspace"]);
    toast.success("Company details saved");
  };

  const savePolicy = async () => {
    if (!policy) return;
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

  const monthlyTotal = overheads.reduce((s, o) => s + monthlyOverheadAmount(o), 0);

  const importPresetFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const count = await importPresets(JSON.parse(await file.text()));
      toast.success(`${count} presets imported`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid preset JSON");
    }
  };

  return (
    <>
      <PageHeader
        title="Company settings"
        description="These defaults drive every estimate. Change them once and all new estimates follow."
      />
      {readOnly && (
        <p className="mb-4 rounded-md border border-accent bg-accent/15 px-3 py-2 text-sm">
          Salaries, overheads and pricing policy are limited to Admin and Finance. You can view what
          you have access to, but not change it.
        </p>
      )}

      <Tabs defaultValue={workspace.canManageCosts ? "policy" : "company"}>
        <TabsList>
          <TabsTrigger value="policy">Cost & pricing policy</TabsTrigger>
          <TabsTrigger value="overheads">Overheads</TabsTrigger>
          <TabsTrigger value="features">Feature Library & JSON</TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
          {workspace.isAdmin && <TabsTrigger value="team">Team</TabsTrigger>}
        </TabsList>

        {workspace.isAdmin && (
          <TabsContent value="team" className="pt-6">
            <TeamSettings workspace={workspace} />
          </TabsContent>
        )}

        <TabsContent value="policy" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">How costs turn into prices</CardTitle>
              <CardDescription>
                Fewer billable hours means a higher hourly cost. Contingency covers risk; margin is
                the profit you want to keep.
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
                      onChange={(e) =>
                        setPolicy({ ...policy, working_days_per_year: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Hours per working day">
                    <Input
                      type="number"
                      disabled={readOnly}
                      value={policy.hours_per_day}
                      onChange={(e) =>
                        setPolicy({ ...policy, hours_per_day: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Default utilization %" hint="Used when a person has no target set">
                    <Input
                      type="number"
                      disabled={readOnly}
                      value={policy.default_utilization_pct}
                      onChange={(e) =>
                        setPolicy({ ...policy, default_utilization_pct: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Default contingency %">
                    <Input
                      type="number"
                      disabled={readOnly}
                      value={policy.default_contingency_pct}
                      onChange={(e) =>
                        setPolicy({ ...policy, default_contingency_pct: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Pricing approach">
                    <Select
                      disabled={readOnly}
                      value={policy.pricing_mode}
                      onValueChange={(v) => setPolicy({ ...policy, pricing_mode: v })}
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
                      onChange={(e) =>
                        setPolicy({ ...policy, rounding_step: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Default target margin %">
                    <Input
                      type="number"
                      disabled={readOnly}
                      value={policy.default_margin_pct}
                      onChange={(e) =>
                        setPolicy({ ...policy, default_margin_pct: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Default markup %">
                    <Input
                      type="number"
                      disabled={readOnly}
                      value={policy.default_markup_pct}
                      onChange={(e) =>
                        setPolicy({ ...policy, default_markup_pct: Number(e.target.value) })
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
        </TabsContent>

        <TabsContent value="overheads" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">Overheads</CardTitle>
              <CardDescription>
                Total {formatMoney(monthlyTotal, currency)} per month, shared evenly across active
                people.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {overheads.map((o) => (
                <div key={o.id} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                  <Input
                    disabled={readOnly}
                    defaultValue={o.name}
                    onBlur={(e) => updateOverhead(o.id, { name: e.target.value })}
                  />
                  <Input
                    disabled={readOnly}
                    defaultValue={o.category ?? ""}
                    placeholder="Category"
                    onBlur={(e) => updateOverhead(o.id, { category: e.target.value || null })}
                  />
                  <Input
                    disabled={readOnly}
                    type="number"
                    defaultValue={Number(o.monthly_amount)}
                    onBlur={(e) => updateOverhead(o.id, { monthly_amount: Number(e.target.value) })}
                  />
                  <Select
                    disabled={readOnly}
                    value={o.period ?? "monthly"}
                    onValueChange={(period) => updateOverhead(o.id, { period })}
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
                    <Button variant="ghost" size="icon" onClick={() => removeOverhead(o.id)}>
                      <Trash2 className="size-4" />
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
        </TabsContent>

        <TabsContent value="company" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">Company details</CardTitle>
              <CardDescription>Shown on proposals and reports.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Company name">
                <Input
                  disabled={readOnly || !workspace.isAdmin}
                  value={company.name}
                  onChange={(e) => setCompany({ ...company, name: e.target.value })}
                />
              </Field>
              <Field label="Industry">
                <Input
                  disabled={readOnly || !workspace.isAdmin}
                  value={company.industry}
                  onChange={(e) => setCompany({ ...company, industry: e.target.value })}
                />
              </Field>
              <Field label="Currency">
                <Input
                  disabled={readOnly || !workspace.isAdmin}
                  value={company.currency}
                  onChange={(e) =>
                    setCompany({ ...company, currency: e.target.value.toUpperCase() })
                  }
                />
              </Field>
              {workspace.isAdmin && (
                <div className="sm:col-span-2">
                  <Button onClick={saveCompany}>Save company</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="pt-6 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="size-5 text-violet-600" />
                    <span>Software Scope Feature Library & JSON Hub</span>
                  </CardTitle>
                  <CardDescription>
                    Manage your company's standard and custom feature catalog. Import bulk features
                    via JSON format or export your library.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setIsLibraryManagerOpen(true)}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-semibold gap-1.5"
                >
                  <BookOpen className="size-4" />
                  <span>Open Feature Library Manager</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-muted/40 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-sm">JSON Format & Bulk Maintenance</h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                    You can maintain this library completely through structured JSON. The manager
                    provides the exact schema template, sample files, and live validation before
                    importing directly to your Supabase workspace database.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLibraryManagerOpen(true)}
                  className="shrink-0"
                >
                  Manage & Import JSON
                </Button>
              </div>
              <div className="rounded-xl border bg-muted/40 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-sm">Estimate presets</h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                    Import a JSON array of presets. Imported presets are shared with both
                    calculators in this workspace.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    id="preset-json-upload"
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(event) => {
                      void importPresetFile(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                  <Button variant="outline" size="sm" asChild>
                    <label htmlFor="preset-json-upload" className="cursor-pointer">
                      <Upload className="size-4" /> Import JSON
                    </label>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={readOnly}
                    onClick={() => void resetPresets()}
                  >
                    <RotateCcw className="size-4" /> Reset
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border bg-muted/40 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-sm">Preset library</h4>
                    <p className="text-xs text-muted-foreground">
                      {presets.length} presets are available to this workspace.
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{preset.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{preset.category}</p>
                      </div>
                      {!readOnly && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title={`Remove custom override for ${preset.title}`}
                          disabled={!presets.some((item) => item.id === preset.id)}
                          onClick={() =>
                            void deletePreset(preset.id).catch((error) =>
                              toast.error(error.message),
                            )
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <FeatureLibraryManager
            open={isLibraryManagerOpen}
            onOpenChange={setIsLibraryManagerOpen}
            companyId={companyId}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
