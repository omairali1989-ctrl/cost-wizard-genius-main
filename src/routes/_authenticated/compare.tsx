import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { PageHeader } from "@/components/AppShell";
import type { WorkspaceData } from "@/lib/workspace";
import { formatMoney, type CalculationResults } from "@/lib/pricing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/compare")({
  head: () => ({
    meta: [
      { title: "Compare scenarios — CostCraft" },
      { name: "description", content: "Put saved estimate versions side by side before you decide." },
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
        .select("id, label, version, results, projects(name)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const chosen = data.filter((c) => selected.includes(c.id));

  const rows: [string, (r: CalculationResults) => string][] = [
    ["Team hours", (r) => `${Math.round(r.totalHours)} h`],
    ["Delivery cost", (r) => formatMoney(r.laborCost, currency)],
    ["Contingency", (r) => formatMoney(r.contingencyAmount, currency)],
    ["Total cost", (r) => formatMoney(r.totalCost, currency)],
    ["Profit", (r) => formatMoney(r.profit, currency)],
    ["Margin", (r) => `${r.marginPct.toFixed(1)}%`],
    ["Client price", (r) => formatMoney(r.price, currency)],
  ];

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
                    setSelected((prev) =>
                      v ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                    )
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
                    <th className="pb-2 text-left font-medium">Measure</th>
                    {chosen.map((c) => (
                      <th key={c.id} className="pb-2 text-right font-medium">
                        {(c.projects as { name?: string } | null)?.name} v{c.version}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([label, fn]) => (
                    <tr key={label} className="border-t">
                      <td className="py-2 text-muted-foreground">{label}</td>
                      {chosen.map((c) => (
                        <td key={c.id} className="py-2 text-right tabular">
                          {fn(c.results as unknown as CalculationResults)}
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
