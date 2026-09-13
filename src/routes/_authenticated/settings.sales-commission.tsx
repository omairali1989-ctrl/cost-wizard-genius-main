import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { CommissionRulesSettings } from "@/components/settings/CommissionRulesSettings";
import {
  SettingsPageHeader,
  SettingsReadOnlyNotice,
} from "@/components/settings/SettingsPageHeader";

export const Route = createFileRoute("/_authenticated/settings/sales-commission")({
  head: () => ({
    meta: [
      { title: "Sales commission — CostCraft" },
      { name: "description", content: "Manage workspace sales commission models and rules." },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      {(workspace) => {
        const readOnly = !workspace.canManageCosts;
        return (
          <>
            <SettingsPageHeader
              title="Sales commission"
              description="Define the commission rules applied to projects and revenue."
            />
            {readOnly && <SettingsReadOnlyNotice />}
            <CommissionRulesSettings
              companyId={workspace.company!.id}
              currency={workspace.company!.currency}
              readOnly={readOnly}
            />
          </>
        );
      }}
    </WorkspaceGate>
  ),
});
