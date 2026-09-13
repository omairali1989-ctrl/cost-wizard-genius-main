import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { PageHeader } from "@/components/AppShell";
import { logActivity, type WorkspaceData } from "@/lib/workspace";
import { formatMoney, type CalculationResults } from "@/lib/pricing";
import {
  normalizeProjectStatus,
  summarizeProjectRevenue,
  type ProjectStatus,
} from "@/lib/project-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ProjectStatusBadge, ProjectStatusSelect } from "@/components/projects/ProjectStatusSelect";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({
    meta: [
      { title: "Projects — CostCraft" },
      { name: "description", content: "All saved project estimates and their versions." },
      { property: "og:title", content: "Projects — CostCraft" },
      { property: "og:description", content: "All saved project estimates and versions." },
    ],
  }),
  component: () => <WorkspaceGate>{(ws) => <ProjectsInner workspace={ws} />}</WorkspaceGate>,
});

function ProjectsInner({ workspace }: { workspace: WorkspaceData }) {
  const companyId = workspace.company!.id;
  const currency = workspace.company!.currency;
  const queryClient = useQueryClient();
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const { data = [] } = useQuery({
    queryKey: ["projects", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, client_name, status, created_at, calculations(id, version, results)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const projects = data.map((project) => {
    const calculations = (project.calculations ?? []) as unknown as Array<{
      id: string;
      version: number;
      results: CalculationResults | null;
    }>;
    const latest = [...calculations].sort((a, b) => Number(b.version) - Number(a.version))[0];
    return {
      ...project,
      status: normalizeProjectStatus(project.status),
      calculations,
      price: Number(latest?.results?.price ?? 0),
    };
  });

  const revenue = summarizeProjectRevenue(projects);

  const updateStatus = async (projectId: string, projectName: string, status: ProjectStatus) => {
    setSavingStatusId(projectId);
    const { error } = await supabase.from("projects").update({ status }).eq("id", projectId);
    setSavingStatusId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity(companyId, "status_changed", "project", projectId, {
      name: projectName,
      status,
    });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["business-intelligence"] }),
      queryClient.invalidateQueries({ queryKey: ["calculations-dashboard"] }),
    ]);
    toast.success(`Project marked ${status.replace("_", " ")}`);
  };

  return (
    <>
      <PageHeader
        title="Projects"
        description="Track every estimate from quote through delivery and completed revenue."
        action={
          <Button asChild>
            <Link to="/calculator">New estimate</Link>
          </Button>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Estimated value"
          value={formatMoney(revenue.estimatedValue, currency)}
          hint={`${projects.length} projects across all statuses`}
        />
        <StatCard
          label="Sent pipeline"
          value={formatMoney(revenue.sentPipeline, currency)}
          hint={`${revenue.counts.sent} awaiting client decision`}
        />
        <StatCard
          label="Booked revenue"
          value={formatMoney(revenue.bookedRevenue, currency)}
          hint="Approved, in progress and completed"
        />
        <StatCard
          label="Completed revenue"
          value={formatMoney(revenue.completedRevenue, currency)}
          hint={`${revenue.counts.completed} completed projects`}
        />
      </div>
      <Card>
        <CardContent className="divide-y p-0">
          {projects.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">No projects yet.</p>
          )}
          {projects.map((project) => (
            <div
              key={project.id}
              className="flex flex-wrap items-center gap-3 px-4 py-4 hover:bg-secondary/40"
            >
              <Link to="/projects/$id" params={{ id: project.id }} className="min-w-0 flex-1">
                <p className="truncate font-medium hover:underline">{project.name}</p>
                <p className="text-xs text-muted-foreground">
                  {project.client_name ?? "No client"} ·{" "}
                  {new Date(project.created_at).toLocaleDateString()} ·{" "}
                  {project.calculations.length} version(s)
                </p>
              </Link>
              <span className="min-w-[120px] text-right text-sm font-semibold tabular-nums">
                {formatMoney(project.price, currency)}
              </span>
              {workspace.canEdit ? (
                <ProjectStatusSelect
                  status={project.status}
                  disabled={savingStatusId === project.id}
                  onValueChange={(status) => updateStatus(project.id, project.name, status)}
                />
              ) : (
                <ProjectStatusBadge status={project.status} />
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
