import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { PageHeader } from "@/components/AppShell";
import type { WorkspaceData } from "@/lib/workspace";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activity trail — CostCraft" },
      { name: "description", content: "See who changed costs, projects and estimates, and when." },
      { property: "og:title", content: "Activity trail — CostCraft" },
      { property: "og:description", content: "A record of every change in your workspace." },
    ],
  }),
  component: () => <WorkspaceGate>{(ws) => <ActivityInner workspace={ws} />}</WorkspaceGate>,
});

function ActivityInner({ workspace }: { workspace: WorkspaceData }) {
  const companyId = workspace.company!.id;
  const { data = [] } = useQuery({
    queryKey: ["audit", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      <PageHeader
        title="Activity trail"
        description="Every change is recorded and cannot be edited or deleted."
      />
      <Card>
        <CardContent className="divide-y p-0">
          {data.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">No activity yet.</p>
          )}
          {data.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <Badge variant="secondary" className="uppercase">
                {row.action}
              </Badge>
              <span className="font-medium">{row.entity.replace("_", " ")}</span>
              <span className="text-muted-foreground">
                {(row.details as Record<string, unknown>)?.["name"] as string}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(row.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
