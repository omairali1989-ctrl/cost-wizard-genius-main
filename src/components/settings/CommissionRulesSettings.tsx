import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logActivity, useCommissionRules, useInvalidate } from "@/lib/workspace";
import {
  COMMISSION_SCOPES,
  MODEL_META,
  computeCommission,
  type CommissionModel,
  type CommissionRule,
  type CommissionScope,
} from "@/lib/commission";
import { formatMoney } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SCOPE_LABEL: Record<CommissionScope, string> = {
  project: "One project",
  employee: "One person",
  role: "A role",
  department: "A department",
  sales_category: "A sales category",
  tenant: "Whole workspace",
};

const BASIS_LABEL: Record<string, string> = {
  sales_value: "Sales value",
  collected_revenue: "Collected revenue",
  gross_profit: "Gross profit",
};

type RuleRow = CommissionRule & { company_id?: string };

/** Maps a database row (snake_case) onto the engine's rule shape. */
const toRule = (row: Record<string, unknown>): RuleRow => ({
  id: String(row["id"]),
  name: String(row["name"] ?? "Rule"),
  model: (row["model"] as CommissionModel) ?? "percentage_of_sales_value",
  scope: (row["scope"] as CommissionScope) ?? "tenant",
  scopeValue: (row["scope_value"] as string) ?? null,
  ratePct: row["rate_pct"] === null ? null : Number(row["rate_pct"]),
  fixedAmount: row["fixed_amount"] === null ? null : Number(row["fixed_amount"]),
  tiers: (row["tiers"] as CommissionRule["tiers"]) ?? [],
  tierMode: (row["tier_mode"] as "marginal" | "flat") ?? "marginal",
  targetAmount: row["target_amount"] === null ? null : Number(row["target_amount"]),
  belowTargetRatePct:
    row["below_target_rate_pct"] === null ? null : Number(row["below_target_rate_pct"]),
  aboveTargetRatePct:
    row["above_target_rate_pct"] === null ? null : Number(row["above_target_rate_pct"]),
  basis: (row["basis"] as CommissionRule["basis"]) ?? null,
  active: row["active"] !== false,
});

interface Props {
  companyId: string;
  currency: string;
  readOnly: boolean;
}

export function CommissionRulesSettings({ companyId, currency, readOnly }: Props) {
  const { data: rows = [] } = useCommissionRules(companyId);
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  // A worked example makes the difference between models concrete.
  const [sampleValue, setSampleValue] = useState(5_000_000);

  const rules = (rows as Record<string, unknown>[]).map(toRule);

  const write = async (action: () => Promise<{ error: { message: string } | null }>) => {
    setBusy(true);
    try {
      const { error } = await action();
      if (error) throw new Error(error.message);
      invalidate(["commission-rules"]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the rule");
    } finally {
      setBusy(false);
    }
  };

  const addRule = () =>
    write(async () => {
      const res = await supabase.from("commission_rules").insert({
        company_id: companyId,
        name: "New commission rule",
        model: "percentage_of_sales_value",
        scope: "tenant",
        rate_pct: 3,
      } as never);
      await logActivity(companyId, "created", "commission_rule", null, {});
      return res as { error: { message: string } | null };
    });

  const patch = (id: string, changes: Record<string, unknown>) =>
    write(async () => {
      const res = await supabase
        .from("commission_rules")
        .update(changes as never)
        .eq("id", id);
      return res as { error: { message: string } | null };
    });

  const remove = (rule: RuleRow) => {
    if (!confirm(`Delete "${rule.name}"?`)) return;
    void write(async () => {
      const res = await supabase.from("commission_rules").delete().eq("id", rule.id);
      await logActivity(companyId, "deleted", "commission_rule", rule.id, { name: rule.name });
      return res as { error: { message: string } | null };
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">Sales commission rules</CardTitle>
        <CardDescription>
          Commission is no longer a fixed percentage. Set as many rules as you need — the most
          specific one that matches a deal wins, in the order project, person, role, department,
          sales category, then the workspace default.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3">
          <div>
            <label htmlFor="commission-sample" className="text-xs font-medium">
              Worked example on a deal of
            </label>
            <Input
              id="commission-sample"
              type="number"
              min={0}
              step={100000}
              className="mt-1 w-44 tabular-nums"
              value={sampleValue}
              onChange={(e) => setSampleValue(Number(e.target.value) || 0)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Each rule below shows what it would pay on this amount.
          </p>
        </div>

        {rules.length === 0 ? (
          <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            No commission rules yet. Without one, estimates carry no sales commission.
          </p>
        ) : (
          <ul className="space-y-3 p-0">
            {rules.map((rule) => {
              const worked = computeCommission(rule, {
                salesValue: sampleValue,
                collectedRevenue: sampleValue,
                grossProfit: sampleValue * 0.3,
              });
              return (
                <li key={rule.id} className="space-y-3 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor={`name-${rule.id}`} className="sr-only">
                      Rule name
                    </label>
                    <Input
                      id={`name-${rule.id}`}
                      className="h-8 max-w-64 text-sm font-medium"
                      disabled={readOnly}
                      defaultValue={rule.name}
                      onBlur={(e) => patch(rule.id, { name: e.target.value })}
                    />
                    {!rule.active && (
                      <Badge variant="outline" className="text-[10px]">
                        Inactive
                      </Badge>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          className="size-3.5 accent-current"
                          disabled={readOnly}
                          checked={rule.active !== false}
                          onChange={(e) => patch(rule.id, { active: e.target.checked })}
                        />
                        Active
                      </label>
                      {!readOnly && (
                        <Button variant="ghost" size="icon" onClick={() => remove(rule)}>
                          <Trash2 className="size-4" aria-hidden="true" />
                          <span className="sr-only">Delete {rule.name}</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                      <label htmlFor={`model-${rule.id}`} className="text-xs font-medium">
                        Model
                      </label>
                      <select
                        id={`model-${rule.id}`}
                        disabled={readOnly}
                        value={rule.model}
                        onChange={(e) => patch(rule.id, { model: e.target.value })}
                        className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {(Object.keys(MODEL_META) as CommissionModel[]).map((m) => (
                          <option key={m} value={m}>
                            {MODEL_META[m].label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`scope-${rule.id}`} className="text-xs font-medium">
                        Applies to
                      </label>
                      <select
                        id={`scope-${rule.id}`}
                        disabled={readOnly}
                        value={rule.scope}
                        onChange={(e) => patch(rule.id, { scope: e.target.value })}
                        className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {COMMISSION_SCOPES.map((s) => (
                          <option key={s} value={s}>
                            {SCOPE_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`scopeval-${rule.id}`} className="text-xs font-medium">
                        Match value
                      </label>
                      <Input
                        id={`scopeval-${rule.id}`}
                        className="mt-1 h-9 text-xs"
                        disabled={readOnly || rule.scope === "tenant"}
                        placeholder={rule.scope === "tenant" ? "—" : "e.g. Sales"}
                        defaultValue={rule.scopeValue ?? ""}
                        onBlur={(e) => patch(rule.id, { scope_value: e.target.value || null })}
                      />
                    </div>
                    <div>
                      <label htmlFor={`basis-${rule.id}`} className="text-xs font-medium">
                        Paid on
                      </label>
                      <select
                        id={`basis-${rule.id}`}
                        disabled={readOnly}
                        value={rule.basis ?? MODEL_META[rule.model].defaultBasis}
                        onChange={(e) => patch(rule.id, { basis: e.target.value })}
                        className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {Object.entries(BASIS_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    {rule.model === "fixed_per_project" ? (
                      <div>
                        <label htmlFor={`fixed-${rule.id}`} className="text-xs font-medium">
                          Fixed amount
                        </label>
                        <Input
                          id={`fixed-${rule.id}`}
                          type="number"
                          min={0}
                          className="mt-1 h-9 text-xs tabular-nums"
                          disabled={readOnly}
                          defaultValue={rule.fixedAmount ?? 0}
                          onBlur={(e) => patch(rule.id, { fixed_amount: Number(e.target.value) })}
                        />
                      </div>
                    ) : rule.model === "target_based" ? (
                      <>
                        <div>
                          <label htmlFor={`target-${rule.id}`} className="text-xs font-medium">
                            Target
                          </label>
                          <Input
                            id={`target-${rule.id}`}
                            type="number"
                            min={0}
                            className="mt-1 h-9 text-xs tabular-nums"
                            disabled={readOnly}
                            defaultValue={rule.targetAmount ?? 0}
                            onBlur={(e) =>
                              patch(rule.id, { target_amount: Number(e.target.value) })
                            }
                          />
                        </div>
                        <div>
                          <label htmlFor={`below-${rule.id}`} className="text-xs font-medium">
                            Rate below %
                          </label>
                          <Input
                            id={`below-${rule.id}`}
                            type="number"
                            min={0}
                            className="mt-1 h-9 text-xs tabular-nums"
                            disabled={readOnly}
                            defaultValue={rule.belowTargetRatePct ?? 0}
                            onBlur={(e) =>
                              patch(rule.id, { below_target_rate_pct: Number(e.target.value) })
                            }
                          />
                        </div>
                        <div>
                          <label htmlFor={`above-${rule.id}`} className="text-xs font-medium">
                            Rate above %
                          </label>
                          <Input
                            id={`above-${rule.id}`}
                            type="number"
                            min={0}
                            className="mt-1 h-9 text-xs tabular-nums"
                            disabled={readOnly}
                            defaultValue={rule.aboveTargetRatePct ?? 0}
                            onBlur={(e) =>
                              patch(rule.id, { above_target_rate_pct: Number(e.target.value) })
                            }
                          />
                        </div>
                      </>
                    ) : rule.model === "tiered" ? (
                      <div className="sm:col-span-4">
                        <label htmlFor={`tiers-${rule.id}`} className="text-xs font-medium">
                          Bands — one per line: from | to (blank for no limit) | rate %
                        </label>
                        <textarea
                          id={`tiers-${rule.id}`}
                          disabled={readOnly}
                          className="mt-1 min-h-20 w-full rounded-md border border-input bg-background p-2 font-mono text-xs"
                          defaultValue={(rule.tiers ?? [])
                            .map((t) => `${t.fromAmount} | ${t.toAmount ?? ""} | ${t.ratePct}`)
                            .join("\n")}
                          onBlur={(e) => {
                            try {
                              const tiers = e.target.value
                                .split("\n")
                                .map((line) => line.trim())
                                .filter(Boolean)
                                .map((line) => {
                                  const [from, to, rate] = line.split("|").map((x) => x.trim());
                                  return {
                                    fromAmount: Number(from) || 0,
                                    toAmount: to ? Number(to) : null,
                                    ratePct: Number(rate) || 0,
                                  };
                                });
                              void patch(rule.id, { tiers });
                            } catch {
                              toast.error("Each band must read: from | to | rate %");
                            }
                          }}
                        />
                        <label className="mt-1 flex items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            className="size-3.5 accent-current"
                            disabled={readOnly}
                            checked={rule.tierMode !== "flat"}
                            onChange={(e) =>
                              patch(rule.id, { tier_mode: e.target.checked ? "marginal" : "flat" })
                            }
                          />
                          Charge each band only on the portion inside it (otherwise the whole amount
                          takes the top band&apos;s rate)
                        </label>
                      </div>
                    ) : (
                      <div>
                        <label htmlFor={`rate-${rule.id}`} className="text-xs font-medium">
                          Rate %
                        </label>
                        <Input
                          id={`rate-${rule.id}`}
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          className="mt-1 h-9 text-xs tabular-nums"
                          disabled={readOnly}
                          defaultValue={rule.ratePct ?? 0}
                          onBlur={(e) => patch(rule.id, { rate_pct: Number(e.target.value) })}
                        />
                      </div>
                    )}
                  </div>

                  <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                    On {formatMoney(sampleValue, currency)} this pays{" "}
                    <span className="font-medium text-foreground">
                      {formatMoney(worked.amount, currency)}
                    </span>{" "}
                    — {worked.explanation}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        {!readOnly && (
          <Button onClick={addRule} disabled={busy} variant="outline" className="gap-2">
            <Plus className="size-4" aria-hidden="true" /> Add commission rule
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
