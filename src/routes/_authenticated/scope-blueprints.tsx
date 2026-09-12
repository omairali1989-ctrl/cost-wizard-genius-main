import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { PageHeader } from "@/components/AppShell";
import { FeatureLibraryManager } from "@/components/scope-engine/FeatureLibraryManager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspaceData } from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/scope-blueprints")({
  head: () => ({
    meta: [
      { title: "Software Scope Blueprint — CostCraft" },
      {
        name: "description",
        content: "Create, update and remove the feature blueprints used in software estimates.",
      },
      { property: "og:title", content: "Software Scope Blueprint — CostCraft" },
      {
        property: "og:description",
        content: "Manage the company feature catalog used by the scope engine.",
      },
    ],
  }),
  component: () => (
    <WorkspaceGate>{(workspace) => <ScopeBlueprints workspace={workspace} />}</WorkspaceGate>
  ),
});

function ScopeBlueprints({ workspace }: { workspace: WorkspaceData }) {
  const [managerOpen, setManagerOpen] = useState(true);
  const canManage = workspace.canManageCosts;

  return (
    <>
      <PageHeader
        title="Software Scope Blueprint"
        description="Maintain the reusable feature definitions your team uses to scope and price software work."
        action={
          <Button
            onClick={() => setManagerOpen(true)}
            className="gap-2 bg-violet-600 text-white hover:bg-violet-700"
          >
            <BookOpen className="size-4" /> Open blueprint library
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <BookOpen className="size-5 text-violet-600" />
              Company blueprint library
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Add reusable features with descriptions, tags and role-based effort hours. Changes are
              immediately available in the calculator&apos;s Scope Engine.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <Plus className="mb-2 size-4 text-violet-600" />
                <p className="font-medium text-foreground">Add</p>
                <p className="mt-1 text-xs">Create a company-specific feature blueprint.</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <Pencil className="mb-2 size-4 text-violet-600" />
                <p className="font-medium text-foreground">Update</p>
                <p className="mt-1 text-xs">Adjust scope notes, tags or effort assumptions.</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <Trash2 className="mb-2 size-4 text-red-500" />
                <p className="font-medium text-foreground">Delete</p>
                <p className="mt-1 text-xs">Remove custom blueprints after confirmation.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <ShieldCheck className="size-5 text-emerald-600" />
              Access & safety
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <p>
              Standard blueprints are shared read-only defaults. Custom blueprints belong to this
              company workspace.
            </p>
            <p>
              {canManage
                ? "Your role can add, update and delete custom blueprints."
                : "Your role can browse the library, but only Admin and Finance can change it."}
            </p>
          </CardContent>
        </Card>
      </div>

      <FeatureLibraryManager
        open={managerOpen}
        onOpenChange={setManagerOpen}
        companyId={workspace.company!.id}
        canManage={canManage}
      />
    </>
  );
}
