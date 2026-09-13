import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PROJECT_STATUSES,
  normalizeProjectStatus,
  projectStatusLabel,
  type ProjectStatus,
} from "@/lib/project-status";
import { cn } from "@/lib/utils";

const statusClass: Record<ProjectStatus, string> = {
  draft: "border-border bg-muted/50 text-muted-foreground",
  sent: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  in_progress: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  completed: "border-primary/30 bg-primary/10 text-primary",
};

export function ProjectStatusBadge({ status }: { status?: string | null | undefined }) {
  const normalized = normalizeProjectStatus(status);
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", statusClass[normalized])}>
      {projectStatusLabel(normalized)}
    </Badge>
  );
}

export function ProjectStatusSelect({
  status,
  onValueChange,
  disabled,
  className,
}: {
  status?: string | null;
  onValueChange: (status: ProjectStatus) => void;
  disabled?: boolean | undefined;
  className?: string;
}) {
  const normalized = normalizeProjectStatus(status);
  return (
    <Select
      value={normalized}
      onValueChange={(value) => onValueChange(value as ProjectStatus)}
      disabled={Boolean(disabled)}
    >
      <SelectTrigger
        aria-label="Project status"
        className={cn("h-8 w-[138px] text-xs", statusClass[normalized], className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PROJECT_STATUSES.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
