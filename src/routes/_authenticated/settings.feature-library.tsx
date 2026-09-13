import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, RotateCcw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { FeatureLibraryManager } from "@/components/scope-engine/FeatureLibraryManager";
import { usePresetLibrary } from "@/components/calculator/qce/presetLibrary";
import {
  SettingsPageHeader,
  SettingsReadOnlyNotice,
} from "@/components/settings/SettingsPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspaceData } from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/settings/feature-library")({
  head: () => ({
    meta: [
      { title: "Feature library & JSON — CostCraft" },
      { name: "description", content: "Manage scope features and estimate presets through JSON." },
    ],
  }),
  component: () => (
    <WorkspaceGate>{(workspace) => <FeatureLibraryPage workspace={workspace} />}</WorkspaceGate>
  ),
});

function FeatureLibraryPage({ workspace }: { workspace: WorkspaceData }) {
  const companyId = workspace.company!.id;
  const readOnly = !workspace.canManageCosts;
  const [isLibraryManagerOpen, setIsLibraryManagerOpen] = useState(false);
  const { presets, importPresets, deletePreset, resetPresets } = usePresetLibrary(companyId);

  const importPresetFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const count = await importPresets(JSON.parse(await file.text()));
      toast.success(`${count} presets imported`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid preset JSON");
    }
  };

  return (
    <>
      <SettingsPageHeader
        title="Feature library & JSON"
        description="Maintain reusable scope features and estimate presets for your workspace."
      />
      {readOnly && <SettingsReadOnlyNotice />}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="size-5 text-foreground" />
                <span>Software Scope Feature Library & JSON Hub</span>
              </CardTitle>
              <CardDescription>
                Manage your company&apos;s standard and custom feature catalog. Import bulk features
                via JSON format or export your library.
              </CardDescription>
            </div>
            <Button
              onClick={() => setIsLibraryManagerOpen(true)}
              className="gap-1.5 bg-primary font-semibold text-white hover:bg-primary"
            >
              <BookOpen className="size-4" />
              <span>Open Feature Library Manager</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-start justify-between gap-4 rounded-xl border bg-muted/40 p-4 sm:flex-row sm:items-center">
            <div>
              <h4 className="text-sm font-semibold">JSON Format & Bulk Maintenance</h4>
              <p className="mt-1 max-w-xl text-xs text-muted-foreground">
                You can maintain this library completely through structured JSON. The manager
                provides the exact schema template, sample files, and live validation before
                importing directly to your Supabase workspace database.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLibraryManagerOpen(true)}
              className="shrink-0"
            >
              Manage & Import JSON
            </Button>
          </div>
          <div className="flex flex-col items-start justify-between gap-4 rounded-xl border bg-muted/40 p-4 sm:flex-row sm:items-center">
            <div>
              <h4 className="text-sm font-semibold">Estimate presets</h4>
              <p className="mt-1 max-w-xl text-xs text-muted-foreground">
                Import a JSON array of presets. Imported presets are shared with both calculators in
                this workspace.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <input
                id="preset-json-upload"
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  void importPresetFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <Button variant="outline" size="sm" asChild>
                <label htmlFor="preset-json-upload" className="cursor-pointer">
                  <Upload className="size-4" /> Import JSON
                </label>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={readOnly}
                onClick={() => void resetPresets()}
              >
                <RotateCcw className="size-4" /> Reset
              </Button>
            </div>
          </div>
          <div className="rounded-xl border bg-muted/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold">Preset library</h4>
                <p className="text-xs text-muted-foreground">
                  {presets.length} presets are available to this workspace.
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{preset.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{preset.category}</p>
                  </div>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title={`Remove custom override for ${preset.title}`}
                      disabled={!presets.some((item) => item.id === preset.id)}
                      onClick={() =>
                        void deletePreset(preset.id).catch((error) => toast.error(error.message))
                      }
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      <span className="sr-only">Remove custom override for {preset.title}</span>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <FeatureLibraryManager
        open={isLibraryManagerOpen}
        onOpenChange={setIsLibraryManagerOpen}
        companyId={companyId}
        canManage={workspace.canManageCosts}
      />
    </>
  );
}
