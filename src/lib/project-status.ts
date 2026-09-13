export const PROJECT_STATUSES = [
  {
    value: "draft",
    label: "Draft",
    description: "Internal estimate; excluded from pipeline and revenue.",
  },
  {
    value: "sent",
    label: "Sent",
    description: "Quote sent to the client; counted as open pipeline.",
  },
  {
    value: "approved",
    label: "Approved",
    description: "Client approved; counted as booked revenue.",
  },
  {
    value: "in_progress",
    label: "In progress",
    description: "Delivery underway; counted as booked revenue.",
  },
  {
    value: "completed",
    label: "Completed",
    description: "Delivery finished; counted as completed revenue.",
  },
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]["value"];

const STATUS_VALUES = new Set<string>(PROJECT_STATUSES.map((status) => status.value));

export function normalizeProjectStatus(status: string | null | undefined): ProjectStatus {
  const normalized = String(status ?? "draft")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return STATUS_VALUES.has(normalized) ? (normalized as ProjectStatus) : "draft";
}

export function projectStatusLabel(status: string | null | undefined): string {
  const normalized = normalizeProjectStatus(status);
  return PROJECT_STATUSES.find((option) => option.value === normalized)?.label ?? "Draft";
}

export function isRevenueStatus(status: string | null | undefined): boolean {
  const normalized = normalizeProjectStatus(status);
  return normalized === "approved" || normalized === "in_progress" || normalized === "completed";
}

export interface ProjectValueRecord {
  status?: string | null | undefined;
  price: number;
}

export function summarizeProjectRevenue(projects: ProjectValueRecord[]) {
  const summary = {
    estimatedValue: 0,
    draftValue: 0,
    sentPipeline: 0,
    bookedRevenue: 0,
    approvedRevenue: 0,
    inProgressRevenue: 0,
    completedRevenue: 0,
    counts: {
      draft: 0,
      sent: 0,
      approved: 0,
      in_progress: 0,
      completed: 0,
    } satisfies Record<ProjectStatus, number>,
  };

  for (const project of projects) {
    const status = normalizeProjectStatus(project.status);
    const price = Number.isFinite(Number(project.price)) ? Math.max(0, Number(project.price)) : 0;
    summary.estimatedValue += price;
    summary.counts[status] += 1;

    if (status === "draft") summary.draftValue += price;
    if (status === "sent") summary.sentPipeline += price;
    if (status === "approved") summary.approvedRevenue += price;
    if (status === "in_progress") summary.inProgressRevenue += price;
    if (status === "completed") summary.completedRevenue += price;
    if (isRevenueStatus(status)) summary.bookedRevenue += price;
  }

  return summary;
}
