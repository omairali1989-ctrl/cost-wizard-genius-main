import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney, type CalculationInputs, type CalculationResults } from "@/lib/pricing";
import {
  History,
  CheckCircle2,
  Clock,
  ArrowRight,
  Plus,
  Save,
  GitBranch,
  Calendar,
  DollarSign,
  Layers,
  ChevronRight,
} from "lucide-react";

export interface CalculationRecord {
  id: string;
  company_id: string;
  project_id: string;
  label?: string;
  version: number;
  inputs: CalculationInputs;
  results: CalculationResults;
  is_snapshot?: boolean;
  created_at: string;
  updated_at?: string;
}

interface VersionHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  currentVersion: number | null;
  currency: string;
  onSelectVersion: (record: CalculationRecord) => void;
  onSaveNewVersion: (versionLabel: string) => Promise<void>;
  isSaving?: boolean;
}

export function VersionHistoryModal({
  open,
  onOpenChange,
  projectId,
  currentVersion,
  currency,
  onSelectVersion,
  onSaveNewVersion,
  isSaving,
}: VersionHistoryModalProps) {
  const [newVersionLabel, setNewVersionLabel] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Fetch all saved versions for the project
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["project-versions", projectId],
    enabled: !!projectId && open,
    queryFn: async (): Promise<CalculationRecord[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("calculations")
        .select("*")
        .eq("project_id", projectId)
        .order("version", { ascending: false });
      if (error) {
        console.error("Failed to load versions:", error);
        return [];
      }
      return (data ?? []) as unknown as CalculationRecord[];
    },
  });

  const nextVersionNumber = (versions[0]?.version ?? 0) + 1;

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = newVersionLabel.trim() || `Version ${nextVersionNumber}`;
    await onSaveNewVersion(label);
    setNewVersionLabel("");
    setIsCreatingNew(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b from-primary/10 via-card to-background">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <DialogTitle className="font-display font-bold text-lg flex items-center gap-2">
                <History className="size-5 text-primary" />
                <span>Estimate Version History</span>
                {currentVersion && (
                  <Badge
                    variant="secondary"
                    className="text-xs font-mono font-bold bg-primary/10 text-primary"
                  >
                    Active: v{currentVersion}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Browse, restore, or create snapshot versions of this project's cost estimate.
              </DialogDescription>
            </div>

            <Button
              size="sm"
              onClick={() => setIsCreatingNew((prev) => !prev)}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              <Plus className="size-3.5" />
              <span>{isCreatingNew ? "Cancel" : "Save New Version"}</span>
            </Button>
          </div>
        </div>

        {/* Create New Version Form Panel */}
        {isCreatingNew && (
          <form
            onSubmit={handleSaveSubmit}
            className="p-4 bg-muted/40 border-b space-y-3 animate-in fade-in-50"
          >
            <div className="flex items-center gap-2">
              <GitBranch className="size-4 text-primary" />
              <span className="text-xs font-bold text-foreground">
                Create Version {nextVersionNumber} Snapshot
              </span>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">
                Version Notes / Description
              </label>
              <Input
                aria-label="Version Notes / Description"
                value={newVersionLabel}
                onChange={(e) => setNewVersionLabel(e.target.value)}
                placeholder={`e.g. Added mobile app squad, adjusted to 15% margin...`}
                className="h-8 text-xs"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsCreatingNew(false)}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSaving}
                className="h-7 text-xs gap-1.5 font-semibold bg-primary hover:bg-primary text-white"
              >
                <Save className="size-3" />
                <span>{isSaving ? "Saving..." : `Save as v${nextVersionNumber}`}</span>
              </Button>
            </div>
          </form>
        )}

        {/* Version List */}
        <ScrollArea className="flex-1 p-5">
          {!projectId ? (
            <div className="py-12 text-center space-y-2">
              <Clock className="size-8 text-muted-foreground/50 mx-auto" />
              <p className="text-sm font-semibold text-foreground">Project Not Saved Yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Save your initial estimate first to start creating and tracking version iterations.
              </p>
            </div>
          ) : isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Loading version history...
            </div>
          ) : versions.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <History className="size-8 text-muted-foreground/50 mx-auto" />
              <p className="text-sm font-semibold text-foreground">No Saved Versions Found</p>
              <p className="text-xs text-muted-foreground">
                Save your current calculation as Version 1 to begin tracking iterations.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((ver) => {
                const isCurrent = currentVersion === ver.version;
                const formattedDate = new Date(ver.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const price = ver.results?.price ?? 0;
                const hours = ver.results?.totalHours ?? 0;
                // The realised margin, not the target knob: in markup mode the knob is
                // never applied, and any discount pushes the achieved margin below it.
                // The project page shows results.marginPct, so this must match.
                const margin = ver.results?.marginPct ?? 0;

                return (
                  <div
                    key={ver.id}
                    className={`rounded-xl border p-3.5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isCurrent
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-xs"
                        : "border-border/70 hover:bg-muted/40"
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={isCurrent ? "default" : "outline"}
                          className="font-mono text-xs font-bold"
                        >
                          v{ver.version}
                        </Badge>
                        <h4 className="text-sm font-semibold text-foreground truncate">
                          {ver.label || `Version ${ver.version}`}
                        </h4>
                        {isCurrent && (
                          <span className="flex items-center gap-1 text-[10px] text-foreground dark:text-muted-foreground font-semibold bg-muted px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="size-3" /> Active Now
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {formattedDate}
                        </span>
                      </div>
                    </div>

                    {/* Metrics + Action */}
                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0">
                      <div className="text-right">
                        <div className="text-sm font-bold font-display text-primary">
                          {formatMoney(price, currency)}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {hours}h • {margin.toFixed(1)}% margin
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant={isCurrent ? "secondary" : "outline"}
                        onClick={() => {
                          onSelectVersion(ver);
                          onOpenChange(false);
                          toast.success(`Restored estimate Version ${ver.version}!`);
                        }}
                        className="h-8 gap-1 text-xs font-semibold"
                      >
                        <span>{isCurrent ? "Reload" : "Load Version"}</span>
                        <ArrowRight className="size-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
