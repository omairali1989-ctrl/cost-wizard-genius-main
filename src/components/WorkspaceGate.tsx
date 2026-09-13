import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useWorkspace, type WorkspaceData } from "@/lib/workspace";

export function WorkspaceGate({
  children,
}: {
  children: (
    workspace: WorkspaceData & { company: NonNullable<WorkspaceData["company"]> },
  ) => ReactNode;
}) {
  const { data, isLoading } = useWorkspace();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && data && !data.company) navigate({ to: "/setup", replace: true });
  }, [isLoading, data, navigate]);

  if (isLoading || !data?.company) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AppShell>
      {children(data as WorkspaceData & { company: NonNullable<WorkspaceData["company"]> })}
    </AppShell>
  );
}
