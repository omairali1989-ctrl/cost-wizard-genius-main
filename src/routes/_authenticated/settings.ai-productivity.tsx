import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { AiProductivitySettings } from "@/components/settings/AiProductivitySettings";
import {
  SettingsPageHeader,
  SettingsReadOnlyNotice,
} from "@/components/settings/SettingsPageHeader";

export const Route = createFileRoute("/_authenticated/settings/ai-productivity")({
  head: () => ({
    meta: [
      { title: "AI productivity — CostCraft" },
      { name: "description", content: "Configure AI effort-reduction factors by activity." },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      {(workspace) => {
        const readOnly = !workspace.canManageCosts;
        return (
          <>
            <SettingsPageHeader
              title="AI productivity"
              description="Control how AI-assisted work reduces effort across estimate activities."
            />
            {readOnly && <SettingsReadOnlyNotice />}
            <AiProductivitySettings companyId={workspace.company!.id} readOnly={readOnly} />
          </>
        );
      }}
    </WorkspaceGate>
  ),
});
