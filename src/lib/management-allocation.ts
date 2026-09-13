/**
 * Management Allocation Engine.
 *
 * Executive time is real cost, but charging a CEO's whole salary to every project
 * is nonsense — so is leaving it out entirely. Each management person carries the
 * share of their time that reaches delivery work at all, and a basis describing how
 * that share is split between the projects running against it.
 */

import { convertCurrency } from "@/lib/currency";

export type AllocationBasis =
  | "project_revenue"
  | "project_cost"
  | "project_duration"
  | "resource_hours"
  | "equal"
  | "percentage"
  | "custom";

export const ALLOCATION_BASIS_META: Record<
  AllocationBasis,
  { label: string; description: string }
> = {
  project_revenue: {
    label: "Project revenue",
    description: "Larger deals absorb more management cost.",
  },
  project_cost: {
    label: "Project cost",
    description: "Costlier projects absorb more; independent of what they sell for.",
  },
  project_duration: {
    label: "Project duration",
    description: "Longer projects absorb more, regardless of size.",
  },
  resource_hours: {
    label: "Resource hours",
    description: "Projects consuming more team time absorb more oversight.",
  },
  equal: {
    label: "Equal split",
    description: "Every live project carries the same share.",
  },
  percentage: {
    label: "Fixed percentage of project cost",
    description: "A set percentage added to each project, independent of the pool.",
  },
  custom: {
    label: "Custom amount",
    description: "A fixed amount per project, set by hand.",
  },
};

export interface ManagementPerson {
  id: string;
  name: string;
  job_title?: string | null;
  /** Fully loaded monthly cost in this person's own currency. */
  monthlyCost: number;
  currency: string;
  /** Share of this person's time that reaches project work at all, 0-100. */
  allocationPct: number;
  basis: AllocationBasis;
  /** Used by the "custom" basis only. */
  customAmount?: number | null;
  active?: boolean;
}

/** What a project contributes to each basis, so shares can be worked out. */
export interface ProjectWeight {
  projectId: string;
  revenue: number;
  cost: number;
  durationMonths: number;
  resourceHours: number;
}

const num = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const clampPct = (value: unknown): number => Math.min(Math.max(num(value), 0), 100);

const weightFor = (basis: AllocationBasis, project: ProjectWeight): number => {
  switch (basis) {
    case "project_revenue":
      return Math.max(0, num(project.revenue));
    case "project_cost":
      return Math.max(0, num(project.cost));
    case "project_duration":
      return Math.max(0, num(project.durationMonths));
    case "resource_hours":
      return Math.max(0, num(project.resourceHours));
    case "equal":
      return 1;
    default:
      return 0;
  }
};

export interface AllocationLine {
  personId: string;
  personName: string;
  jobTitle: string | null;
  /** The person's allocatable monthly cost, in the base currency. */
  allocatableMonthlyCost: number;
  allocationPct: number;
  basis: AllocationBasis;
  /** Share of the pool this project takes, 0-1. */
  sharePct: number;
  amount: number;
  explanation: string;
}

export interface AllocationResult {
  lines: AllocationLine[];
  total: number;
}

export interface AllocationOptions {
  people: ManagementPerson[];
  /** The project being costed. */
  project: ProjectWeight;
  /** Every project the pool is spread across, including this one. */
  allProjects: ProjectWeight[];
  baseCurrency: string;
  /** How many months of management cost this project absorbs. */
  months?: number;
}

const money = (value: number) => Math.round(value).toLocaleString();

/**
 * Management cost attributable to one project.
 *
 * The pool-based bases divide a person's allocatable cost between the projects
 * competing for their attention, so adding a project reduces every other project's
 * share rather than inventing new cost. The percentage and custom bases stand alone
 * and are charged per project by design.
 */
export function allocateManagementCost(options: AllocationOptions): AllocationResult {
  const { people, project, allProjects, baseCurrency, months = 1 } = options;
  const activePeople = people.filter((p) => p.active !== false);
  const monthsCharged = Math.max(0, num(months, 1));
  const lines: AllocationLine[] = [];

  for (const person of activePeople) {
    const allocationPct = clampPct(person.allocationPct);
    if (allocationPct <= 0) continue;

    const monthlyCostBase = convertCurrency(
      Math.max(0, num(person.monthlyCost)),
      person.currency || baseCurrency,
      baseCurrency,
    );
    const allocatable = monthlyCostBase * (allocationPct / 100);
    if (allocatable <= 0 && person.basis !== "custom") continue;

    let amount = 0;
    let sharePct = 0;
    let explanation = "";

    if (person.basis === "custom") {
      amount = Math.max(0, num(person.customAmount));
      explanation = `${person.name}: fixed ${money(amount)} charged to this project.`;
    } else if (person.basis === "percentage") {
      // A percentage of this project's own cost, not a share of a pool.
      amount = Math.max(0, num(project.cost)) * (allocationPct / 100);
      sharePct = 1;
      explanation = `${person.name}: ${allocationPct}% of this project's delivery cost.`;
    } else {
      const totalWeight = allProjects.reduce((sum, p) => sum + weightFor(person.basis, p), 0);
      const ownWeight = weightFor(person.basis, project);
      sharePct = totalWeight > 0 ? ownWeight / totalWeight : 0;
      amount = allocatable * monthsCharged * sharePct;
      const basisLabel = ALLOCATION_BASIS_META[person.basis].label.toLowerCase();
      explanation =
        totalWeight > 0
          ? `${person.name}: ${allocationPct}% of ${money(monthlyCostBase)}/mo over ${monthsCharged} month${monthsCharged === 1 ? "" : "s"}, ` +
            `of which this project takes ${(sharePct * 100).toFixed(1)}% by ${basisLabel}.`
          : `${person.name}: no ${basisLabel} recorded across projects, so nothing is allocated.`;
    }

    if (amount <= 0) continue;
    lines.push({
      personId: person.id,
      personName: person.name,
      jobTitle: person.job_title ?? null,
      allocatableMonthlyCost: allocatable,
      allocationPct,
      basis: person.basis,
      sharePct,
      amount,
      explanation,
    });
  }

  return { lines, total: lines.reduce((sum, line) => sum + line.amount, 0) };
}

/**
 * Total monthly management cost the company carries, and how much of it is
 * allocatable to projects at all — the rest is genuine business overhead.
 */
export function managementPoolSummary(
  people: ManagementPerson[],
  baseCurrency: string,
): { totalMonthly: number; allocatableMonthly: number; unallocatedMonthly: number } {
  let totalMonthly = 0;
  let allocatableMonthly = 0;
  for (const person of people.filter((p) => p.active !== false)) {
    const cost = convertCurrency(
      Math.max(0, num(person.monthlyCost)),
      person.currency || baseCurrency,
      baseCurrency,
    );
    totalMonthly += cost;
    allocatableMonthly += cost * (clampPct(person.allocationPct) / 100);
  }
  return {
    totalMonthly,
    allocatableMonthly,
    unallocatedMonthly: totalMonthly - allocatableMonthly,
  };
}
