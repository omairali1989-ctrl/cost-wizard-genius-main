// ─── Shared types & constants for the Quick Cost Estimator ───────────────────

import type { TimeUnit } from "@/lib/pricing";

export type RoleGroup = "dev" | "design" | "pm_qa" | "leadership";

export interface TeamMemberRate {
  id: string;
  name: string;
  job_title: string | null;
  department: string | null;
  seniority: string | null;
  skills: string[];
  active: boolean;
  hourly_cost: number;
}

export interface MemberAllocation {
  mode: "sync" | "custom";
  percent?: number | undefined;
  customValue?: number | undefined;
  customUnit?: TimeUnit | undefined;
}

export interface TeamGroupDuration {
  mode: "sync_project" | "custom";
  value: number;
  unit: TimeUnit;
}

export type ProjectPresetId = string;

export type PresetCategory =
  | "All"
  | "Mobile & Backend"
  | "CMS & E-Commerce"
  | "Design & Creatives"
  | "Startups & Custom";

export type StackCategory =
  | "frontend"
  | "backend"
  | "mobile"
  | "database"
  | "design"
  | "qa"
  | "devops"
  | "management"
  | "other";

export interface BlueprintStackItem {
  id: string;
  tech: string;
  category: StackCategory;
  suggestedEmployeeSubstr?: string;
  roleLabel: string;
  allocationPct: number;
}

export interface LinkedStackItem {
  id: string;
  tech: string;
  category: StackCategory;
  roleLabel: string;
  allocationPct: number;
  employeeId: string;
}

export interface PresetConfig {
  id: ProjectPresetId;
  category: PresetCategory;
  badge: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  defaultDurationValue: number;
  defaultDurationUnit: TimeUnit;
  suggestedRoles: Array<{
    nameSubstr: string;
    label: string;
    allocationPct: number;
  }>;
  techStack?: BlueprintStackItem[];
}

export const ROLE_GROUP_INFO: Record<
  RoleGroup,
  { label: string; icon: string; badgeClass: string }
> = {
  dev: {
    label: "Development Team",
    icon: "💻",
    badgeClass:
      "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800",
  },
  design: {
    label: "Design & Creative",
    icon: "🎨",
    badgeClass:
      "bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-800",
  },
  pm_qa: {
    label: "PM & QA",
    icon: "📋",
    badgeClass:
      "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800",
  },
  leadership: {
    label: "Leadership & Sales",
    icon: "💼",
    badgeClass:
      "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800",
  },
};

export function getEmployeeRoleGroup(emp: TeamMemberRate): RoleGroup {
  const title = (emp.job_title || "").toLowerCase();
  const dept = (emp.department || "").toLowerCase();
  if (title.includes("design") || dept === "design") return "design";
  if (
    title.includes("project manager") ||
    title.includes("qa") ||
    title.includes("quality")
  )
    return "pm_qa";
  if (
    title.includes("director") ||
    title.includes("sales") ||
    dept === "sales" ||
    dept === "management"
  )
    return "leadership";
  return "dev";
}

export const PRESET_CATEGORIES: PresetCategory[] = [
  "All",
  "Mobile & Backend",
  "CMS & E-Commerce",
  "Design & Creatives",
  "Startups & Custom",
];
