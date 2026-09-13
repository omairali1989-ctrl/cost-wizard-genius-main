/**
 * Sales Commission Engine.
 *
 * Commission was a single hardcoded 5% paid to one named person. It is now a set
 * of tenant-configurable rules: several models, several bases, and a resolution
 * order so a rule can be set for the whole tenant and overridden for a department,
 * a role, an individual or one specific project.
 *
 * Every calculation returns an explanation alongside the number, because a
 * commission figure someone is paid on needs to be arguable, not just displayed.
 */

export type CommissionModel =
  | "percentage_of_sales_value"
  | "percentage_of_collected_revenue"
  | "percentage_of_gross_profit"
  | "fixed_per_project"
  | "tiered"
  | "target_based"
  | "hybrid";

/** Most specific scope wins; the order of this list is the resolution order. */
export const COMMISSION_SCOPES = [
  "project",
  "employee",
  "role",
  "department",
  "sales_category",
  "tenant",
] as const;

export type CommissionScope = (typeof COMMISSION_SCOPES)[number];

export type CommissionBasis = "sales_value" | "collected_revenue" | "gross_profit";

export interface CommissionTier {
  /** Inclusive lower bound of the band. */
  fromAmount: number;
  /** Exclusive upper bound; null means "and above". */
  toAmount: number | null;
  ratePct: number;
}

export interface CommissionRule {
  id: string;
  name: string;
  model: CommissionModel;
  scope: CommissionScope;
  /** Employee id, role, department, project id or sales category. Null for tenant scope. */
  scopeValue?: string | null;
  ratePct?: number | null;
  fixedAmount?: number | null;
  tiers?: CommissionTier[] | null;
  targetAmount?: number | null;
  belowTargetRatePct?: number | null;
  aboveTargetRatePct?: number | null;
  basis?: CommissionBasis | null;
  /** Tiered only: marginal charges each band its own rate; flat charges one rate on the whole amount. */
  tierMode?: "marginal" | "flat" | null;
  active?: boolean;
}

export const MODEL_META: Record<
  CommissionModel,
  { label: string; description: string; defaultBasis: CommissionBasis }
> = {
  percentage_of_sales_value: {
    label: "Percentage of sales value",
    description: "A flat rate on the quoted selling price.",
    defaultBasis: "sales_value",
  },
  percentage_of_collected_revenue: {
    label: "Percentage of collected revenue",
    description: "Paid on cash actually collected, not on what was invoiced.",
    defaultBasis: "collected_revenue",
  },
  percentage_of_gross_profit: {
    label: "Percentage of gross profit",
    description: "Rewards margin rather than volume, so discounting costs the seller too.",
    defaultBasis: "gross_profit",
  },
  fixed_per_project: {
    label: "Fixed amount per project",
    description: "A flat fee per won project, regardless of size.",
    defaultBasis: "sales_value",
  },
  tiered: {
    label: "Tiered by value",
    description: "Rate rises through bands as the value increases.",
    defaultBasis: "sales_value",
  },
  target_based: {
    label: "Target based",
    description: "One rate below the target and a higher rate above it.",
    defaultBasis: "sales_value",
  },
  hybrid: {
    label: "Hybrid (salary plus commission)",
    description: "A reduced commission rate alongside a basic salary.",
    defaultBasis: "sales_value",
  },
};

export interface CommissionContext {
  projectId?: string | null;
  employeeId?: string | null;
  role?: string | null;
  department?: string | null;
  salesCategory?: string | null;
}

const matchesScope = (rule: CommissionRule, context: CommissionContext): boolean => {
  const value = (rule.scopeValue ?? "").trim().toLowerCase();
  const eq = (candidate?: string | null) =>
    Boolean(value) && (candidate ?? "").trim().toLowerCase() === value;
  switch (rule.scope) {
    case "tenant":
      return true;
    case "project":
      return eq(context.projectId);
    case "employee":
      return eq(context.employeeId);
    case "role":
      return eq(context.role);
    case "department":
      return eq(context.department);
    case "sales_category":
      return eq(context.salesCategory);
    default:
      return false;
  }
};

/** The most specific active rule that applies, or undefined when none does. */
export function resolveCommissionRule(
  rules: CommissionRule[],
  context: CommissionContext,
): CommissionRule | undefined {
  const active = rules.filter((rule) => rule.active !== false);
  for (const scope of COMMISSION_SCOPES) {
    const found = active.find((rule) => rule.scope === scope && matchesScope(rule, context));
    if (found) return found;
  }
  return undefined;
}

export interface CommissionAmounts {
  salesValue: number;
  collectedRevenue?: number;
  grossProfit?: number;
}

export interface CommissionResult {
  amount: number;
  /** The figure the rate was applied to. */
  basisAmount: number;
  basis: CommissionBasis;
  effectiveRatePct: number;
  explanation: string;
}

const num = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const nonNegative = (value: unknown): number => Math.max(0, num(value));

const money = (value: number) => Math.round(value).toLocaleString();

const basisAmountFor = (basis: CommissionBasis, amounts: CommissionAmounts): number => {
  switch (basis) {
    case "collected_revenue":
      return nonNegative(amounts.collectedRevenue ?? amounts.salesValue);
    case "gross_profit":
      // A loss-making project earns no commission rather than a negative one.
      return Math.max(0, num(amounts.grossProfit));
    case "sales_value":
    default:
      return nonNegative(amounts.salesValue);
  }
};

/** Sorted, non-overlapping bands with the open-ended one last. */
const orderedTiers = (tiers: CommissionTier[]): CommissionTier[] =>
  [...tiers].sort((a, b) => num(a.fromAmount) - num(b.fromAmount));

function computeTiered(rule: CommissionRule, base: number): { amount: number; detail: string } {
  const tiers = orderedTiers(rule.tiers ?? []);
  if (!tiers.length) return { amount: 0, detail: "no tiers configured" };

  if (rule.tierMode === "flat") {
    // Whole amount charged at the rate of the band it lands in.
    const band =
      tiers.find(
        (t) => base >= num(t.fromAmount) && (t.toAmount === null || base < num(t.toAmount)),
      ) ?? tiers[tiers.length - 1]!;
    const amount = base * (num(band.ratePct) / 100);
    return {
      amount,
      detail: `${money(base)} charged wholly at the ${num(band.ratePct)}% band`,
    };
  }

  // Marginal: each band charges only the portion of value that falls inside it.
  let amount = 0;
  const parts: string[] = [];
  for (const tier of tiers) {
    const from = num(tier.fromAmount);
    const to =
      tier.toAmount === null || tier.toAmount === undefined ? Infinity : num(tier.toAmount);
    if (base <= from) break;
    const portion = Math.min(base, to) - from;
    if (portion <= 0) continue;
    const part = portion * (num(tier.ratePct) / 100);
    amount += part;
    parts.push(`${money(portion)} @ ${num(tier.ratePct)}%`);
  }
  return { amount, detail: parts.join(" + ") || "below the first band" };
}

/** Applies one rule to one deal. */
export function computeCommission(
  rule: CommissionRule | undefined,
  amounts: CommissionAmounts,
): CommissionResult {
  const salesValue = nonNegative(amounts.salesValue);
  if (!rule) {
    return {
      amount: 0,
      basisAmount: salesValue,
      basis: "sales_value",
      effectiveRatePct: 0,
      explanation: "No commission rule applies to this estimate.",
    };
  }

  const basis = rule.basis ?? MODEL_META[rule.model].defaultBasis;
  const base = basisAmountFor(basis, amounts);
  const basisLabel = basis.replace(/_/g, " ");

  let amount = 0;
  let explanation = "";

  switch (rule.model) {
    case "fixed_per_project": {
      amount = nonNegative(rule.fixedAmount);
      explanation = `${rule.name}: flat ${money(amount)} per project.`;
      break;
    }
    case "tiered": {
      const { amount: tiered, detail } = computeTiered(rule, base);
      amount = tiered;
      explanation = `${rule.name}: tiered on ${basisLabel} — ${detail}.`;
      break;
    }
    case "target_based": {
      const target = nonNegative(rule.targetAmount);
      const below = num(rule.belowTargetRatePct);
      const above = num(rule.aboveTargetRatePct, below);
      if (base <= target) {
        amount = base * (below / 100);
        explanation = `${rule.name}: ${money(base)} of ${basisLabel} is under the ${money(target)} target, so ${below}% applies.`;
      } else {
        // Only the excess earns the accelerated rate.
        amount = target * (below / 100) + (base - target) * (above / 100);
        explanation = `${rule.name}: ${money(target)} at ${below}% plus ${money(base - target)} over target at ${above}%.`;
      }
      break;
    }
    case "hybrid": {
      const rate = num(rule.ratePct);
      amount = base * (rate / 100);
      explanation = `${rule.name}: ${rate}% of ${basisLabel} alongside a basic salary.`;
      break;
    }
    default: {
      const rate = num(rule.ratePct);
      amount = base * (rate / 100);
      explanation = `${rule.name}: ${rate}% of ${basisLabel} (${money(base)}).`;
      break;
    }
  }

  amount = Math.max(0, amount);
  return {
    amount,
    basisAmount: base,
    basis,
    effectiveRatePct: base > 0 ? (amount / base) * 100 : 0,
    explanation,
  };
}

/** Convenience: resolve then compute in one step. */
export function commissionFor(
  rules: CommissionRule[],
  context: CommissionContext,
  amounts: CommissionAmounts,
): CommissionResult & { rule: CommissionRule | undefined } {
  const rule = resolveCommissionRule(rules, context);
  return { ...computeCommission(rule, amounts), rule };
}
