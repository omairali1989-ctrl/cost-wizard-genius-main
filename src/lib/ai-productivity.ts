/**
 * AI productivity factors.
 *
 * Modern delivery leans on AI for boilerplate, tests, docs and review, so a flat
 * "everything takes as long as it always did" estimate overstates cost. But the
 * saving is not uniform: architecture, discovery, UAT, security sign-off and
 * production deployment still need the same human hours. Factors are therefore
 * per ACTIVITY, not per project.
 */

export type ActivityKind =
  | "discovery"
  | "stakeholder_approval"
  | "architecture"
  | "schema_design"
  | "ui_design"
  | "ui_generation"
  | "boilerplate"
  | "code_generation"
  | "api_development"
  | "refactoring"
  | "debugging"
  | "code_review"
  | "unit_tests"
  | "test_cases"
  | "qa_assistance"
  | "documentation"
  | "devops_automation"
  | "security_validation"
  | "uat"
  | "deployment";

export interface ActivityMeta {
  kind: ActivityKind;
  label: string;
  /** Delivery phase this activity belongs to; drives phase grouping downstream. */
  phase: "discovery" | "design" | "build" | "qa" | "launch";
  /** Share of effort AI removes, 0-90. */
  defaultReductionPct: number;
  /** Why this activity does or does not benefit — shown next to the input. */
  rationale: string;
}

/**
 * Defaults are deliberately conservative. Anything requiring human judgement,
 * accountability or a third party stays at or near zero: you cannot AI your way
 * through a client sign-off or a production cutover.
 */
export const ACTIVITY_CATALOG: ActivityMeta[] = [
  {
    kind: "discovery",
    label: "Discovery & requirements",
    phase: "discovery",
    defaultReductionPct: 0,
    rationale: "Requires stakeholder conversations and judgement; AI does not shorten it.",
  },
  {
    kind: "stakeholder_approval",
    label: "Stakeholder review & approvals",
    phase: "discovery",
    defaultReductionPct: 0,
    rationale: "Gated by other people's calendars, not by how fast work is produced.",
  },
  {
    kind: "architecture",
    label: "Architecture & technical design",
    phase: "design",
    defaultReductionPct: 5,
    rationale: "AI helps explore options, but the decisions and trade-offs stay human.",
  },
  {
    kind: "schema_design",
    label: "Database & schema design",
    phase: "design",
    defaultReductionPct: 20,
    rationale: "Scaffolding and migrations generate well; the data model still needs design.",
  },
  {
    kind: "ui_design",
    label: "UI/UX design",
    phase: "design",
    defaultReductionPct: 15,
    rationale: "Exploration is faster; research and craft are not.",
  },
  {
    kind: "ui_generation",
    label: "UI implementation",
    phase: "build",
    defaultReductionPct: 30,
    rationale: "Component and layout code generates well from a clear design.",
  },
  {
    kind: "boilerplate",
    label: "Boilerplate & CRUD",
    phase: "build",
    defaultReductionPct: 50,
    rationale: "The most mechanical work, and where AI helps most.",
  },
  {
    kind: "code_generation",
    label: "Feature development",
    phase: "build",
    defaultReductionPct: 45,
    rationale: "Substantial help on well-specified features.",
  },
  {
    kind: "api_development",
    label: "API development",
    phase: "build",
    defaultReductionPct: 35,
    rationale: "Endpoints and clients generate well; contracts still need thought.",
  },
  {
    kind: "refactoring",
    label: "Refactoring",
    phase: "build",
    defaultReductionPct: 35,
    rationale: "Mechanical transformations are fast; risky ones still need review.",
  },
  {
    kind: "debugging",
    label: "Debugging",
    phase: "build",
    defaultReductionPct: 20,
    rationale: "Helpful on common faults, little help on novel or systemic ones.",
  },
  {
    kind: "code_review",
    label: "Code review",
    phase: "build",
    defaultReductionPct: 30,
    rationale: "First-pass review is automatable; accountability is not.",
  },
  {
    kind: "unit_tests",
    label: "Unit tests",
    phase: "qa",
    defaultReductionPct: 40,
    rationale: "Generates well against existing code.",
  },
  {
    kind: "test_cases",
    label: "Test case authoring",
    phase: "qa",
    defaultReductionPct: 40,
    rationale: "Cases draft quickly from requirements.",
  },
  {
    kind: "qa_assistance",
    label: "QA execution",
    phase: "qa",
    defaultReductionPct: 30,
    rationale: "Automation helps; exploratory testing still needs a tester.",
  },
  {
    kind: "documentation",
    label: "Documentation",
    phase: "qa",
    defaultReductionPct: 45,
    rationale: "Drafts well from code and tickets.",
  },
  {
    kind: "devops_automation",
    label: "DevOps & automation",
    phase: "launch",
    defaultReductionPct: 25,
    rationale: "Pipeline and config scaffolding helps; environment specifics do not.",
  },
  {
    kind: "security_validation",
    label: "Security validation",
    phase: "launch",
    defaultReductionPct: 0,
    rationale: "Needs accountable human sign-off and often an external party.",
  },
  {
    kind: "uat",
    label: "UAT support",
    phase: "launch",
    defaultReductionPct: 0,
    rationale: "Paced by the client's testing, not by delivery speed.",
  },
  {
    kind: "deployment",
    label: "Production deployment",
    phase: "launch",
    defaultReductionPct: 0,
    rationale: "Release coordination and cutover risk are unchanged.",
  },
];

export const ACTIVITY_BY_KIND: Record<ActivityKind, ActivityMeta> = Object.fromEntries(
  ACTIVITY_CATALOG.map((a) => [a.kind, a]),
) as Record<ActivityKind, ActivityMeta>;

export const ACTIVITY_KINDS = ACTIVITY_CATALOG.map((a) => a.kind);

/** activity kind → reduction percentage actually in force for a workspace. */
export type AiFactorMap = Partial<Record<ActivityKind, number>>;

export const defaultAiFactors = (): Record<ActivityKind, number> =>
  Object.fromEntries(ACTIVITY_CATALOG.map((a) => [a.kind, a.defaultReductionPct])) as Record<
    ActivityKind,
    number
  >;

const clampReduction = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), 90);
};

/** Tenant overrides layered over the built-in defaults. */
export const resolveAiFactors = (overrides?: AiFactorMap | null): Record<ActivityKind, number> => {
  const resolved = defaultAiFactors();
  if (!overrides) return resolved;
  for (const kind of ACTIVITY_KINDS) {
    const value = overrides[kind];
    if (value !== undefined && value !== null) resolved[kind] = clampReduction(value);
  }
  return resolved;
};

/**
 * Apply the factor for one activity. `enabled` lets a project quote the same scope
 * without AI assumptions — useful when a client contracts for traditional delivery.
 */
export const applyAiFactor = (
  baseHours: number,
  kind: ActivityKind,
  factors: Record<ActivityKind, number>,
  enabled = true,
): number => {
  const hours = Number(baseHours);
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  if (!enabled) return hours;
  const reduction = clampReduction(factors[kind] ?? 0);
  return hours * (1 - reduction / 100);
};
