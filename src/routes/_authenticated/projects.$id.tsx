import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { PageHeader } from "@/components/AppShell";
import { useTeamRates, useOverheads, type WorkspaceData } from "@/lib/workspace";
import {
  formatMoney,
  type CalculationInputs,
  type CalculationResults,
} from "@/lib/pricing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, Edit3, History, FileText, CheckCircle2 } from "lucide-react";
import { DetailedBreakdownView } from "@/components/calculator/DetailedBreakdownView";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => ({
    meta: [
      { title: "Project estimate — CostCraft" },
      { name: "description", content: "Full cost breakdown, price and saved versions for a project." },
      { property: "og:title", content: "Project estimate — CostCraft" },
      { property: "og:description", content: "Full cost breakdown and price for a project." },
    ],
  }),
  component: () => <WorkspaceGate>{(ws) => <ProjectDetail workspace={ws} />}</WorkspaceGate>,
});

function ProjectDetail({ workspace }: { workspace: WorkspaceData }) {
  const { id } = Route.useParams();
  const companyId = workspace.company?.id;
  const currency = workspace.company?.currency ?? "PKR";
  const { data: employees = [] } = useTeamRates(companyId);
  const { data: overheads = [] } = useOverheads(companyId);

  const { data } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const [{ data: project }, { data: calcs }] = await Promise.all([
        supabase.from("projects").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("calculations")
          .select("*")
          .eq("project_id", id)
          .order("version", { ascending: false }),
      ]);
      return { project, calcs: calcs ?? [] };
    },
  });

  const latest = data?.calcs?.[0];
  const results = latest?.results as unknown as CalculationResults | undefined;
  const inputs = latest?.inputs as unknown as CalculationInputs | undefined;

  return (
    <>
      <PageHeader
        title={data?.project?.name ?? "Project Estimate"}
        description={
          data?.project?.client_name
            ? `Client: ${data.project.client_name}`
            : "Software Development Cost & Pricing Proposal"
        }
        action={
          <div className="flex items-center gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
              <Printer className="size-4" />
              <span>Print / Save PDF</span>
            </Button>
            {workspace.canEdit && (
              <Button asChild size="sm" className="gap-1.5">
                <Link to="/calculator" search={{ project: id }}>
                  <Edit3 className="size-4" />
                  <span>Edit / New Version</span>
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {results && inputs && (
        <div className="space-y-6">
          {/* Top Project Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/60 p-4 shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="font-mono text-xs">
                  {latest?.label ?? "Active Version"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Saved on {latest?.created_at ? new Date(latest.created_at).toLocaleDateString() : "recent"}
                </span>
              </div>
              {data?.project?.description && (
                <p className="text-xs text-muted-foreground pt-0.5">{data.project.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-right">
                <span className="block text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Approved Quoted Price
                </span>
                <span className="font-display text-xl font-bold text-foreground tabular">
                  {formatMoney(results.price, currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Executive Breakdown Component */}
          <DetailedBreakdownView
            inputs={inputs}
            results={results}
            currency={currency}
            employees={employees}
            overheads={overheads}
          />

          {/* Sidebar & History Row */}
          <div className="grid gap-6 lg:grid-cols-2 print:hidden">
            {/* Project Scope & Notes */}
            <Card className="shadow-xs border">
              <CardHeader className="pb-2.5">
                <CardTitle className="font-display text-sm font-semibold flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  <span>Project Scope & Executive Notes</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {inputs.notes ? (
                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {inputs.notes}
                  </p>
                ) : (
                  <p className="text-muted-foreground/60 italic">No additional notes provided for this version.</p>
                )}
                <div className="pt-2 border-t flex items-center justify-between text-muted-foreground">
                  <span>Margin Applied: {inputs.marginPct}%</span>
                  <span>Contingency Buffer: {inputs.contingencyPct}%</span>
                  <span>Sales Commission: {inputs.salesCommissionPct ?? 5}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Version History Card */}
            <Card className="shadow-xs border">
              <CardHeader className="pb-2.5">
                <CardTitle className="font-display text-sm font-semibold flex items-center gap-2">
                  <History className="size-4 text-primary" />
                  <span>Version History & Audit Log</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  All past calculations saved for this software project.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {data?.calcs.map((c) => {
                  const cRes = c.results as unknown as CalculationResults | undefined;
                  const isCurrent = c.id === latest?.id;
                  return (
                    <div
                      key={c.id}
                      className={`flex items-center justify-between rounded-lg border p-2.5 transition ${
                        isCurrent ? "border-primary/40 bg-primary/5" : "bg-card/40 hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant={isCurrent ? "default" : "secondary"} className="font-mono text-[11px]">
                          v{c.version}
                        </Badge>
                        <div>
                          <span className="font-medium text-foreground block">{c.label}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(c.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono tabular font-semibold text-foreground block">
                          {formatMoney(cRes?.price ?? 0, currency)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {cRes?.totalHours ?? 0} hrs · {cRes?.marginPct?.toFixed(0) ?? 0}% margin
                        </span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

