// ─── ProjectDetails ───────────────────────────────────────────────────────────
// Project name, client name, and global duration inputs
import * as React from "react";
import { ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TimeUnit } from "@/lib/pricing";

interface ProjectDetailsProps {
  projectName: string;
  clientName: string;
  durationValue: number;
  durationUnit: TimeUnit;
  onProjectNameChange: (v: string) => void;
  onClientNameChange: (v: string) => void;
  onDurationChange: (value: number, unit: TimeUnit) => void;
}

export const ProjectDetails = React.memo(function ProjectDetails({
  projectName,
  clientName,
  durationValue,
  durationUnit,
  onProjectNameChange,
  onClientNameChange,
  onDurationChange,
}: ProjectDetailsProps) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between border-b pb-2.5">
        <Label className="text-sm font-semibold">2. Project Timeline &amp; Details</Label>
        <div className="flex items-center gap-1 text-xs text-foreground dark:text-muted-foreground font-medium">
          <ShieldCheck className="size-3.5" />
          <span>Overheads, Rent &amp; Director Payroll Absorbed</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {/* Project Name */}
        <div className="space-y-1 sm:col-span-1">
          <Label className="text-xs text-muted-foreground">Project Name</Label>
          <Input
            aria-label="Project Name"
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            placeholder="e.g. Alisons Mobile App"
          />
        </div>

        {/* Client Name */}
        <div className="space-y-1 sm:col-span-1">
          <Label className="text-xs text-muted-foreground">Client Name (Optional)</Label>
          <Input
            aria-label="Client Name (Optional)"
            value={clientName}
            onChange={(e) => onClientNameChange(e.target.value)}
            placeholder="e.g. Acme Corp"
          />
        </div>

        {/* Duration */}
        <div className="space-y-1 sm:col-span-1">
          <Label className="text-xs text-muted-foreground">Duration</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              aria-label="Project duration"
              value={durationValue}
              onChange={(e) => onDurationChange(Math.max(1, Number(e.target.value)), durationUnit)}
              className="w-20"
            />
            <Select
              value={durationUnit}
              onValueChange={(u) => onDurationChange(durationValue, u as TimeUnit)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="days">Days (8h)</SelectItem>
                <SelectItem value="weeks">Weeks (40h)</SelectItem>
                <SelectItem value="months">Months (160h)</SelectItem>
                <SelectItem value="hours">Hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
});
