import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { PageHeader } from "@/components/AppShell";
import type { WorkspaceData } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  const { data = [] } = useQuery({
    queryKey: ["projects", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, client_name, status, created_at, calculations(id)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      <PageHeader
        title="Projects"
        description="Each project keeps every saved version of its estimate."
        action={
          <Button asChild>
            <Link to="/calculator">New estimate</Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="divide-y p-0">
          {data.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">No projects yet.</p>
          )}
          {data.map((p) => (
            <Link
              key={p.id}
              to="/projects/$id"
              params={{ id: p.id }}
              className="flex flex-wrap items-center gap-3 px-4 py-4 hover:bg-secondary/60"
            >
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.client_name ?? "No client"} · {new Date(p.created_at).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="secondary" className="ml-auto">
                {(p.calculations as unknown[])?.length ?? 0} version(s)
              </Badge>
            </Link>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
