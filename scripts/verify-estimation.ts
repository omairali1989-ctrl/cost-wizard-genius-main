import assert from "node:assert/strict";
import {
  computeEffort,
  buildEstimate,
  isBillable,
  type ScopeSelection,
} from "../src/lib/estimation";
import { ACTIVITY_BY_KIND, defaultAiFactors, resolveAiFactors } from "../src/lib/ai-productivity";
import { emptyInputs } from "../src/lib/pricing";

console.log("=== ESTIMATION FOUNDATION ===\n");

const roleRates = {
  backend: 2000,
  frontend: 1800,
  designer: 1500,
  qa: 1200,
  pm: 2200,
  mobile: 1900,
};

const features = [
  {
    id: "auth",
    label: "Authentication & accounts",
    moduleName: "Platform",
    effort: {
      low: { backend: 20, frontend: 10, qa: 6 },
      medium: { backend: 40, frontend: 20, qa: 12 },
      high: { backend: 80, frontend: 40, qa: 24 },
    },
  },
  {
    id: "billing",
    label: "Billing & invoicing",
    moduleName: "Commerce",
    effort: {
      low: { backend: 30, frontend: 15, qa: 8 },
      medium: { backend: 60, frontend: 30, qa: 16 },
      high: { backend: 120, frontend: 60, qa: 32 },
    },
  },
];

// ── 1. AI factors reduce build work but never sign-off work ───────────────────
const factors = defaultAiFactors();
assert.equal(factors.uat, 0, "UAT must not be reduced");
assert.equal(factors.security_validation, 0, "Security validation must not be reduced");
assert.equal(factors.deployment, 0, "Deployment must not be reduced");
assert.equal(factors.stakeholder_approval, 0, "Approvals must not be reduced");
assert.ok(factors.architecture <= 10, "Architecture should barely move");
assert.ok(factors.boilerplate >= 40, "Boilerplate should benefit most");
console.log(
  "1. Non-reducible activities stay at 0%; boilerplate reduces",
  factors.boilerplate + "%",
);

// Tenant overrides layer over defaults and are clamped to a sane ceiling.
const overridden = resolveAiFactors({ boilerplate: 200, uat: 15 });
assert.equal(overridden.boilerplate, 90, "reduction is capped at 90%");
assert.equal(overridden.uat, 15, "an explicit tenant override is honoured");
assert.equal(overridden.documentation, factors.documentation, "unset kinds keep the default");
console.log("2. Overrides clamp at 90% and leave unset activities on defaults");

// ── 2. Effort: base vs AI-adjusted ────────────────────────────────────────────
const selections: ScopeSelection[] = [
  { featureId: "auth", complexity: "medium", quantity: 1, inclusion: "included" },
  { featureId: "billing", complexity: "medium", quantity: 2, inclusion: "included" },
];

const effort = computeEffort({ selections, features, roleRates });

// auth medium = 40+20+12 = 72; billing medium x2 = (60+30+16)*2 = 212
assert.equal(effort.baseHours, 72 + 212, "base hours multiply by quantity");
assert.ok(effort.adjustedHours < effort.baseHours, "AI must reduce total effort");
assert.ok(effort.hoursSavedByAi > 0);
console.log(
  `3. Base ${effort.baseHours}h → adjusted ${effort.adjustedHours.toFixed(1)}h ` +
    `(${effort.effectiveAiReductionPct.toFixed(1)}% saved)`,
);

// Cost must equal the sum of the lines, and lines must reconcile to the role rollup.
const lineCost = effort.lines.reduce((s, l) => s + l.cost, 0);
assert.ok(Math.abs(lineCost - effort.laborCost) < 0.01, "labour cost reconciles with lines");
const roleHours = effort.byRole.reduce((s, r) => s + r.adjustedHours, 0);
assert.ok(Math.abs(roleHours - effort.adjustedHours) < 0.01, "role rollup reconciles");
const phaseHours = effort.byPhase.reduce((s, p) => s + p.adjustedHours, 0);
assert.ok(Math.abs(phaseHours - effort.adjustedHours) < 0.01, "phase rollup reconciles");
console.log("4. Line items reconcile with the role, phase and total rollups");

// ── 3. Turning AI off restores the traditional estimate ───────────────────────
const noAi = computeEffort({ selections, features, roleRates, aiEnabled: false });
assert.equal(noAi.adjustedHours, noAi.baseHours, "with AI off, adjusted equals base");
assert.equal(noAi.hoursSavedByAi, 0);
assert.ok(noAi.laborCost > effort.laborCost, "traditional delivery costs more");
console.log(
  `5. AI off: ${noAi.adjustedHours}h costing ${Math.round(noAi.laborCost).toLocaleString()} ` +
    `vs ${Math.round(effort.laborCost).toLocaleString()} with AI`,
);

// ── 4. Scope classification ───────────────────────────────────────────────────
assert.equal(isBillable("included"), true);
for (const kind of [
  "optional",
  "excluded",
  "tbc",
  "client_dependency",
  "third_party_dependency",
] as const) {
  assert.equal(isBillable(kind), false, `${kind} must not be charged`);
}

const withExclusions = computeEffort({
  selections: [
    { featureId: "auth", complexity: "medium", quantity: 1, inclusion: "included" },
    { featureId: "billing", complexity: "medium", quantity: 1, inclusion: "client_dependency" },
  ],
  features,
  roleRates,
});
assert.equal(withExclusions.baseHours, 72, "only included work reaches the effort total");
assert.equal(withExclusions.excluded.length, 1, "the dependency is still recorded");
assert.equal(withExclusions.excluded[0]?.baseHours, 106, "its effort is stated, not charged");
console.log("6. Non-included scope is listed with its effort but never priced");

// ── 5. Explicit tasks override the role-level fallback ────────────────────────
const tasked = computeEffort({
  selections: [{ featureId: "auth", complexity: "medium", quantity: 1, inclusion: "included" }],
  features,
  roleRates,
  tasks: [
    {
      id: "t1",
      featureId: "auth",
      name: "Auth scaffolding",
      activityKind: "boilerplate",
      roleKey: "backend",
      hours: { low: 10, medium: 20, high: 40 },
    },
    {
      id: "t2",
      featureId: "auth",
      name: "Security review",
      activityKind: "security_validation",
      roleKey: "backend",
      hours: { low: 4, medium: 8, high: 16 },
    },
  ],
});
assert.equal(tasked.baseHours, 28, "tasks replace the role fallback entirely");
assert.equal(
  tasked.lines.every((l) => !l.fromFallback),
  true,
);
const security = tasked.lines.find((l) => l.activityKind === "security_validation");
const scaffold = tasked.lines.find((l) => l.activityKind === "boilerplate");
assert.equal(security?.adjustedHours, 8, "security review is not reduced");
assert.ok((scaffold?.adjustedHours ?? 0) < 20, "scaffolding is reduced");
console.log(
  `7. Task-level factors: scaffolding 20h → ${scaffold?.adjustedHours}h, security 8h → ${security?.adjustedHours}h`,
);

// ── 6. Traceable price chain ──────────────────────────────────────────────────
const inputs = {
  ...emptyInputs(null, "PKR"),
  projectName: "Test",
  contingencyPct: 10,
  pricingMode: "margin" as const,
  marginPct: 30,
  discountPct: 5,
  roundingStep: 100,
};
const estimate = buildEstimate(effort, inputs, "PKR");

assert.ok(estimate.trace.length >= 4, "the chain records each step");
const last = estimate.trace[estimate.trace.length - 1];
assert.ok(
  Math.abs((last?.runningTotal ?? 0) - estimate.results.price) < 0.01,
  "the running total must land exactly on the quoted price",
);
console.log("\n8. Price chain:");
for (const s of estimate.trace) {
  console.log(
    `   ${s.label.padEnd(22)} ${Math.round(s.amount).toLocaleString().padStart(12)}  →  ${Math.round(s.runningTotal).toLocaleString().padStart(12)}`,
  );
}
console.log(
  `   ${"QUOTED PRICE".padEnd(22)} ${" ".repeat(12)}  →  ${Math.round(estimate.results.price).toLocaleString().padStart(12)}`,
);

// Labour in the chain must be the AI-adjusted labour, not the base figure.
assert.ok(
  Math.abs((estimate.trace[0]?.amount ?? 0) - effort.laborCost) < 0.01,
  "the chain starts from AI-adjusted labour",
);

// Every activity referenced by a line must exist in the catalog.
for (const line of effort.lines) {
  assert.ok(ACTIVITY_BY_KIND[line.activityKind], `unknown activity ${line.activityKind}`);
}

console.log("\nALL ESTIMATION FOUNDATION CHECKS PASSED");
