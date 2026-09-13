import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { PageHeader } from "@/components/AppShell";
import type { WorkspaceData } from "@/lib/workspace";
import { formatMoney, type CalculationInputs, type CalculationResults } from "@/lib/pricing";
import { convertCurrency } from "@/lib/currency";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/compare")({
  head: () => ({
    meta: [
      { title: "Compare scenarios — CostCraft" },
      {
        name: "description",
        content: "Put saved estimate versions side by side before you decide.",
      },
      { property: "og:title", content: "Compare scenarios — CostCraft" },
      { property: "og:description", content: "Compare saved estimates side by side." },
    ],
  }),
  component: () => <WorkspaceGate>{(ws) => <Compare workspace={ws} />}</WorkspaceGate>,
});

function Compare({ workspace }: { workspace: WorkspaceData }) {
  const companyId = workspace.company!.id;
  const currency = workspace.company!.currency;
  const [selected, setSelected] = useState<string[]>([]);
  const { data = [] } = useQuery({
    queryKey: ["calculations-all", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calculations")
        .select("id, label, version, inputs, results, created_at, projects(name)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const chosen = data.filter((c) => selected.includes(c.id));

  // Each estimate stores the base currency it was quoted in; the workspace currency can
  // change afterwards, so convert before putting two of them side by side.
  const money = (value: number, from: string) =>
    formatMoney(convertCurrency(value ?? 0, from || currency, currency), currency);

  // Labour alone does not reconcile with Total cost — support, technology and additional
  // work are all inside the subtotal that contingency is charged on.
  const rows: [string, (r: CalculationResults, from: string) => string][] = [
    ["Team hours", (r) => `${Math.round(r.totalHours ?? 0)} h`],
    ["Labour", (r, f) => money(r.laborCost, f)],
    ["Support", (r, f) => money(r.supportCost, f)],
    ["Technology", (r, f) => money(r.technologyCost, f)],
    ["Additional work", (r, f) => money(r.additionalCost, f)],
    ["Subtotal", (r, f) => money(r.subtotal, f)],
    ["Contingency", (r, f) => money(r.contingencyAmount, f)],
    ["Total cost", (r, f) => money(r.totalCost, f)],
    ["Profit", (r, f) => money(r.profit, f)],
    ["Margin", (r) => `${(r.marginPct ?? 0).toFixed(1)}%`],
    ["Client price", (r, f) => money(r.price, f)],
  ];

  const savedCurrency = (c: (typeof data)[number]) =>
    (c.inputs as unknown as CalculationInputs)?.currency || currency;

  return (
    <>
      <PageHeader
        title="Compare scenarios"
        description="Tick two or more saved versions to see them side by side."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Saved versions</CardTitle>
            <CardDescription>{data.length} available</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.map((c) => (
              <label key={c.id} className="flex items-center gap-3">
                <Checkbox
                  checked={selected.includes(c.id)}
                  onCheckedChange={(v) =>
                    setSelected((prev) => (v ? [...prev, c.id] : prev.filter((id) => id !== c.id)))
                  }
                />
                <span>
                  {(c.projects as { name?: string } | null)?.name ?? "Untitled"} · {c.label}
                </span>
              </label>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-x-auto">
          <CardHeader>
            <CardTitle className="font-display text-base">Side by side</CardTitle>
          </CardHeader>
          <CardContent>
            {chosen.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing selected yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="pb-2 text-left font-medium">
                      Measure
                    </th>
                    {chosen.map((c) => (
                      <th key={c.id} scope="col" className="pb-2 text-right font-medium">
                        {(c.projects as { name?: string } | null)?.name} v{c.version}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([label, fn]) => (
                    <tr key={label} className="border-t">
                      <th scope="row" className="py-2 text-left font-normal text-muted-foreground">
                        {label}
                      </th>
                      {chosen.map((c) => (
                        <td key={c.id} className="py-2 text-right tabular">
                          {fn(c.results as unknown as CalculationResults, savedCurrency(c))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
