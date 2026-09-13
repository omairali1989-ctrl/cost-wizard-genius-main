import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { TeamSettings } from "@/components/TeamSettings";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/settings/team")({
  head: () => ({
    meta: [
      { title: "Team — CostCraft" },
      { name: "description", content: "Invite people and manage workspace roles." },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      {(workspace) => (
        <>
          <SettingsPageHeader
            title="Team"
            description="Invite people and manage access to your company workspace."
          />
          {workspace.isAdmin ? (
            <TeamSettings workspace={workspace} />
          ) : (
            <Card>
              <CardContent className="flex items-start gap-3 py-6 text-sm">
                <ShieldAlert className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">Admin access required</p>
                  <p className="mt-1 text-muted-foreground">
                    Only company administrators can view members, invitations, and workspace roles.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </WorkspaceGate>
  ),
});
