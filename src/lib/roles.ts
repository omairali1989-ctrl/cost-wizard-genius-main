export const ROLES = [
  {
    value: "admin",
    label: "Admin",
    description: "Full access, including team, salaries and cost policy.",
  },
  {
    value: "finance",
    label: "Finance",
    description: "Salaries, overheads and cost policy. Cannot manage the team.",
  },
  {
    value: "management",
    label: "Management",
    description: "Sees salaries and every estimate. Can build estimates.",
  },
  {
    value: "project_manager",
    label: "Project Manager",
    description: "Builds and edits estimates. No salary figures.",
  },
  {
    value: "technical_lead",
    label: "Technical Lead",
    description: "Builds and edits estimates. No salary figures.",
  },
  {
    value: "calculator_user",
    label: "Calculator User",
    description: "Builds estimates only. No salary figures.",
  },
  {
    value: "viewer",
    label: "Viewer",
    description: "Read-only. No salary figures, no editing.",
  },
] as const;

export type RoleValue = (typeof ROLES)[number]["value"];

/** Roles that may create and edit projects and estimates. "manager" is the legacy label. */
export const EDIT_ROLES = [
  "admin",
  "manager",
  "management",
  "project_manager",
  "technical_lead",
  "calculator_user",
];

/** Roles that may see salary figures and overheads. */
export const FINANCE_VIEW_ROLES = ["admin", "finance", "management"];

/** Roles that may change salaries, overheads and the cost policy. */
export const COST_MANAGE_ROLES = ["admin", "finance"];

const LEGACY: Record<string, string> = { manager: "Manager (legacy)" };

export const roleLabel = (role: string): string =>
  ROLES.find((r) => r.value === role)?.label ?? LEGACY[role] ?? role;
