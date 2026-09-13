/**
 * Scope → effort → cost → price, with every step recorded.
 *
 * The point of this module is traceability: for any figure the app shows, a user
 * must be able to see which features produced it, what the base effort was, what
 * AI assumption was applied, whose rate it was costed at, and what was added on
 * top. Nothing here re-implements pricing — cost-to-price stays in pricing.ts.
 */

import {
  ACTIVITY_BY_KIND,
  applyAiFactor,
  resolveAiFactors,
  type ActivityKind,
  type AiFactorMap,
} from "@/lib/ai-productivity";
import { calculate, type CalculationInputs, type CalculationResults } from "@/lib/pricing";
import type { Complexity, RoleKey } from "@/components/scope-engine/featureLibrary";

export type ScopeInclusion =
  "included" | "optional" | "excluded" | "tbc" | "client_dependency" | "third_party_dependency";

export const INCLUSION_META: Record<
  ScopeInclusion,
  { label: string; description: string; billable: boolean }
> = {
  included: {
    label: "Included",
    description: "Delivered under this estimate and priced in.",
    billable: true,
  },
  optional: {
    label: "Optional",
    description: "Quoted separately; not part of the headline price.",
    billable: false,
  },
  excluded: {
    label: "Excluded",
    description: "Explicitly out of scope.",
    billable: false,
  },
  tbc: {
    label: "To be confirmed",
    description: "Not yet agreed; priced only once confirmed.",
    billable: false,
  },
  client_dependency: {
    label: "Client dependency",
    description: "The client provides this; we do not cost it.",
    billable: false,
  },
  third_party_dependency: {
    label: "Third-party dependency",
    description: "Delivered by a third party; excluded from our effort.",
    billable: false,
  },
};

/** Only genuinely included work reaches the price. Everything else is stated, not charged. */
export const isBillable = (inclusion: ScopeInclusion) => INCLUSION_META[inclusion].billable;

export interface TaskDefinition {
  id: string;
  featureId: string;
  name: string;
  activityKind: ActivityKind;
  roleKey: RoleKey;
  hours: Record<Complexity, number>;
}

export interface FeatureLike {
  id: string;
  label: string;
  moduleId?: string | null;
  moduleName?: string | null;
  effort: Record<Complexity, Partial<Record<RoleKey, number>>>;
}

export interface ScopeSelection {
  featureId: string;
  complexity: Complexity;
  quantity: number;
  inclusion: ScopeInclusion;
}

/**
 * When a feature has no task breakdown, its role-level effort is treated as one
 * task per role. The activity assumed for each role is deliberately conservative
 * so the fallback never claims a bigger AI saving than an explicit breakdown would.
 */
const ROLE_FALLBACK_ACTIVITY: Record<RoleKey, ActivityKind> = {
  designer: "ui_design",
  frontend: "ui_generation",
  backend: "code_generation",
  mobile: "code_generation",
  pm: "stakeholder_approval",
  qa: "qa_assistance",
};

export interface EffortLine {
  featureId: string;
  featureLabel: string;
  moduleName: string | null;
  taskName: string;
  activityKind: ActivityKind;
  activityLabel: string;
  phase: string;
  roleKey: RoleKey;
  quantity: number;
  baseHours: number;
  aiReductionPct: number;
  adjustedHours: number;
  hourlyRate: number;
  cost: number;
  /** True when the line came from role-level effort rather than a defined task. */
  fromFallback: boolean;
}

export interface ExcludedItem {
  featureId: string;
  featureLabel: string;
  moduleName: string | null;
  inclusion: ScopeInclusion;
  baseHours: number;
}

export interface EffortBreakdown {
  lines: EffortLine[];
  excluded: ExcludedItem[];
  byRole: { role: RoleKey; baseHours: number; adjustedHours: number; cost: number }[];
  byPhase: { phase: string; baseHours: number; adjustedHours: number; cost: number }[];
  byModule: { module: string; baseHours: number; adjustedHours: number; cost: number }[];
  baseHours: number;
  adjustedHours: number;
  hoursSavedByAi: number;
  effectiveAiReductionPct: number;
  laborCost: number;
}

const emptyBreakdown = (): EffortBreakdown => ({
  lines: [],
  excluded: [],
  byRole: [],
  byPhase: [],
  byModule: [],
  baseHours: 0,
  adjustedHours: 0,
  hoursSavedByAi: 0,
  effectiveAiReductionPct: 0,
  laborCost: 0,
});

const positive = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export interface EffortOptions {
  selections: ScopeSelection[];
  features: FeatureLike[];
  tasks?: TaskDefinition[];
  /** Fully loaded internal cost per hour for each role. */
  roleRates: Partial<Record<RoleKey, number>>;
  aiFactorOverrides?: AiFactorMap | null;
  /** Off quotes the same scope with no AI assumption — for traditional-delivery contracts. */
  aiEnabled?: boolean;
}

export function computeEffort(options: EffortOptions): EffortBreakdown {
  const {
    selections,
    features,
    tasks = [],
    roleRates,
    aiFactorOverrides,
    aiEnabled = true,
  } = options;
  if (!selections.length) return emptyBreakdown();

  const factors = resolveAiFactors(aiFactorOverrides);
  const featureById = new Map(features.map((f) => [f.id, f]));
  const tasksByFeature = new Map<string, TaskDefinition[]>();
  for (const task of tasks) {
    const list = tasksByFeature.get(task.featureId) ?? [];
    list.push(task);
    tasksByFeature.set(task.featureId, list);
  }

  const lines: EffortLine[] = [];
  const excluded: ExcludedItem[] = [];

  for (const selection of selections) {
    const feature = featureById.get(selection.featureId);
    if (!feature) continue;
    const quantity = Math.max(1, positive(selection.quantity) || 1);
    const moduleName = feature.moduleName ?? null;

    const featureTasks = tasksByFeature.get(feature.id) ?? [];
    const rows: { name: string; kind: ActivityKind; role: RoleKey; hours: number; fb: boolean }[] =
      featureTasks.length
        ? featureTasks.map((t) => ({
            name: t.name,
            kind: t.activityKind,
            role: t.roleKey,
            hours: positive(t.hours[selection.complexity]),
            fb: false,
          }))
        : Object.entries(feature.effort?.[selection.complexity] ?? {}).map(([role, hours]) => ({
            name: feature.label,
            kind: ROLE_FALLBACK_ACTIVITY[role as RoleKey] ?? "code_generation",
            role: role as RoleKey,
            hours: positive(hours),
            fb: true,
          }));

    if (!isBillable(selection.inclusion)) {
      const baseHours = rows.reduce((s, r) => s + r.hours, 0) * quantity;
      excluded.push({
        featureId: feature.id,
        featureLabel: feature.label,
        moduleName,
        inclusion: selection.inclusion,
        baseHours,
      });
      continue;
    }

    for (const row of rows) {
      if (row.hours <= 0) continue;
      const meta = ACTIVITY_BY_KIND[row.kind];
      const baseHours = row.hours * quantity;
      const adjustedHours = applyAiFactor(baseHours, row.kind, factors, aiEnabled);
      const hourlyRate = positive(roleRates[row.role]);
      lines.push({
        featureId: feature.id,
        featureLabel: feature.label,
        moduleName,
        taskName: row.name,
        activityKind: row.kind,
        activityLabel: meta?.label ?? row.kind,
        phase: meta?.phase ?? "build",
        roleKey: row.role,
        quantity,
        baseHours,
        aiReductionPct: aiEnabled ? (factors[row.kind] ?? 0) : 0,
        adjustedHours,
        hourlyRate,
        cost: adjustedHours * hourlyRate,
        fromFallback: row.fb,
      });
    }
  }

  const group = <K extends string>(key: (l: EffortLine) => K) => {
    const map = new Map<K, { baseHours: number; adjustedHours: number; cost: number }>();
    for (const line of lines) {
      const k = key(line);
      const acc = map.get(k) ?? { baseHours: 0, adjustedHours: 0, cost: 0 };
      acc.baseHours += line.baseHours;
      acc.adjustedHours += line.adjustedHours;
      acc.cost += line.cost;
      map.set(k, acc);
    }
    return map;
  };

  const baseHours = lines.reduce((s, l) => s + l.baseHours, 0);
  const adjustedHours = lines.reduce((s, l) => s + l.adjustedHours, 0);
  const laborCost = lines.reduce((s, l) => s + l.cost, 0);

  return {
    lines,
    excluded,
    byRole: [...group((l) => l.roleKey)].map(([role, v]) => ({ role, ...v })),
    byPhase: [...group((l) => l.phase)].map(([phase, v]) => ({ phase, ...v })),
    byModule: [...group((l) => l.moduleName ?? "Unassigned")].map(([module, v]) => ({
      module,
      ...v,
    })),
    baseHours,
    adjustedHours,
    hoursSavedByAi: baseHours - adjustedHours,
    effectiveAiReductionPct: baseHours > 0 ? ((baseHours - adjustedHours) / baseHours) * 100 : 0,
    laborCost,
  };
}

/** One human-readable step of the cost-to-price chain. */
export interface TraceStep {
  key: string;
  label: string;
  detail: string;
  amount: number;
  /** Running total after this step, so a reader can follow the arithmetic down the column. */
  runningTotal: number;
}

export interface Estimate {
  effort: EffortBreakdown;
  results: CalculationResults;
  trace: TraceStep[];
}

/**
 * Runs the scope through the shared pricing engine and records the chain, so the
 * answer to "why is the price this?" is a list the user can read rather than a
 * number they have to trust.
 */
export function buildEstimate(
  effort: EffortBreakdown,
  inputs: CalculationInputs,
  currency: string,
): Estimate {
  // The engine costs labour from phase allocations; feed it one allocation per role
  // carrying the AI-adjusted hours at that role's blended rate.
  const allocations = effort.byRole
    .filter((r) => r.adjustedHours > 0)
    .map((r) => ({
      id: `role-${r.role}`,
      employeeId: null,
      label: r.role,
      hours: r.adjustedHours,
      hourlyCost: r.adjustedHours > 0 ? r.cost / r.adjustedHours : 0,
    }));

  const results = calculate({
    ...inputs,
    currency,
    phases: [{ id: "phase-scope", name: "Scope", allocations }],
  });

  const trace: TraceStep[] = [];
  let running = 0;
  const step = (key: string, label: string, detail: string, amount: number) => {
    running += amount;
    trace.push({ key, label, detail, amount, runningTotal: running });
  };

  step(
    "labour",
    "Delivery labour",
    `${Math.round(effort.adjustedHours).toLocaleString()} adjusted hours across ${effort.byRole.length} role${effort.byRole.length === 1 ? "" : "s"}`,
    results.laborCost,
  );
  if (results.supportCost > 0)
    step("support", "Support retainer", "Post-launch support hours", results.supportCost);
  if (results.technologyCost > 0)
    step(
      "technology",
      "Technology & licences",
      "Tools, hosting and one-off spend",
      results.technologyCost,
    );
  if (results.additionalCost > 0)
    step(
      "additional",
      "Additional work",
      "Line items added to this estimate",
      results.additionalCost,
    );
  if (results.contingencyAmount > 0)
    step(
      "contingency",
      "Risk contingency",
      `${inputs.contingencyPct}% of the ${results.subtotal.toLocaleString()} subtotal`,
      results.contingencyAmount,
    );

  // Margin/markup is the step from internal cost to the client price.
  const uplift = results.priceBeforeDiscount - results.totalCost;
  if (uplift !== 0)
    step(
      "uplift",
      inputs.pricingMode === "margin" ? "Target margin" : "Markup",
      inputs.pricingMode === "margin"
        ? `Priced to keep ${inputs.marginPct}% margin`
        : `${inputs.markupPct}% on internal cost`,
      uplift,
    );
  if (results.discountAmount > 0)
    step(
      "discount",
      "Discount",
      `${inputs.discountPct}% off the quoted price`,
      -results.discountAmount,
    );

  const rounding = results.price - (results.priceBeforeDiscount - results.discountAmount);
  if (Math.abs(rounding) > 0.005)
    step("rounding", "Rounding", `Rounded to the nearest ${inputs.roundingStep}`, rounding);

  return { effort, results, trace };
}
