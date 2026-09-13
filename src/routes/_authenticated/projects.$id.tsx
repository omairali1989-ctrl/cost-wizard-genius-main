import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { PageHeader } from "@/components/AppShell";
import { useTeamRates, useOverheads, logActivity, type WorkspaceData } from "@/lib/workspace";
import { formatMoney, type CalculationInputs, type CalculationResults } from "@/lib/pricing";
import { type ProjectStatus } from "@/lib/project-status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProjectStatusBadge, ProjectStatusSelect } from "@/components/projects/ProjectStatusSelect";
import {
  Printer,
  Edit3,
  History,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { DetailedBreakdownView } from "@/components/calculator/DetailedBreakdownView";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => ({
    meta: [
      { title: "Project estimate — CostCraft" },
      {
        name: "description",
        content: "Full cost breakdown, price and saved versions for a project.",
      },
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
  const queryClient = useQueryClient();
  const [savingStatus, setSavingStatus] = useState(false);
  const { data: employees = [] } = useTeamRates(companyId);
  const { data: overheads = [] } = useOverheads(companyId);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const [{ data: project, error: projectError }, { data: calcs, error: calculationsError }] =
        await Promise.all([
          supabase.from("projects").select("*").eq("id", id).maybeSingle(),
          supabase
            .from("calculations")
            .select("*")
            .eq("project_id", id)
            .order("version", { ascending: false }),
        ]);
      if (projectError) throw projectError;
      if (calculationsError) throw calculationsError;
      return { project, calcs: calcs ?? [] };
    },
  });

  const latest = data?.calcs?.[0];
  const results = latest?.results as unknown as CalculationResults | undefined;
  const inputs = latest?.inputs as unknown as CalculationInputs | undefined;

  const updateStatus = async (status: ProjectStatus) => {
    if (!data?.project || !companyId) return;
    setSavingStatus(true);
    const { error } = await supabase.from("projects").update({ status }).eq("id", id);
    setSavingStatus(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity(companyId, "status_changed", "project", id, {
      name: data.project.name,
      status,
    });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["project", id] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["business-intelligence"] }),
      queryClient.invalidateQueries({ queryKey: ["calculations-dashboard"] }),
    ]);
    toast.success(`Project marked ${status.replace("_", " ")}`);
  };

  if (isLoading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertTriangle className="size-8 text-destructive" />
          <h2 className="font-display text-lg font-semibold">Project could not be loaded</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Check your access and try again."}
          </p>
          <Button asChild variant="outline">
            <Link to="/projects">Back to projects</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data?.project) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertTriangle className="size-8 text-muted-foreground" />
          <h2 className="font-display text-lg font-semibold">Project not found</h2>
          <p className="text-sm text-muted-foreground">
            It may have been removed or you may not have access.
          </p>
          <Button asChild variant="outline">
            <Link to="/projects">Back to projects</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!latest || !results || !inputs) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <FileText className="size-8 text-muted-foreground" />
          <h2 className="font-display text-lg font-semibold">No saved estimate yet</h2>
          <p className="text-sm text-muted-foreground">
            This project exists, but it has no readable calculation version.
          </p>
          {workspace.canEdit && (
            <Button asChild>
              <Link to="/calculator" search={{ project: id }}>
                Create a version
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

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
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {workspace.canEdit ? (
              <ProjectStatusSelect
                status={data.project.status}
                disabled={savingStatus}
                onValueChange={updateStatus}
              />
            ) : (
              <ProjectStatusBadge status={data.project.status} />
            )}
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
                  Saved on{" "}
                  {latest?.created_at ? new Date(latest.created_at).toLocaleDateString() : "recent"}
                </span>
              </div>
              {data?.project?.description && (
                <p className="text-xs text-muted-foreground pt-0.5">{data.project.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-muted px-3 py-1.5 text-right">
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
                  <p className="text-muted-foreground/60 italic">
                    No additional notes provided for this version.
                  </p>
                )}
                <div className="pt-2 border-t flex items-center justify-between text-muted-foreground">
                  <span>Target margin: {inputs.marginPct}%</span>
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
                        isCurrent
                          ? "border-primary/40 bg-primary/5"
                          : "bg-card/40 hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={isCurrent ? "default" : "secondary"}
                          className="font-mono text-[11px]"
                        >
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
