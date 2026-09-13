import assert from "node:assert/strict";
import {
  commissionFor,
  computeCommission,
  resolveCommissionRule,
  type CommissionRule,
} from "../src/lib/commission";
import {
  allocateManagementCost,
  managementPoolSummary,
  type ManagementPerson,
  type ProjectWeight,
} from "../src/lib/management-allocation";
import { calculate, emptyInputs } from "../src/lib/pricing";

console.log("=== MANAGEMENT ALLOCATION & SALES COMMISSION ===\n");

// ── 1. Commission model coverage ──────────────────────────────────────────────
const base = { id: "r", name: "Rule", scope: "tenant" as const, active: true };

const flat = computeCommission(
  { ...base, model: "percentage_of_sales_value", ratePct: 3 },
  { salesValue: 5_000_000 },
);
assert.equal(flat.amount, 150_000, "3% of 5,000,000 is 150,000");
console.log("1. Percentage of sales value: 5,000,000 @ 3% =", flat.amount.toLocaleString());

const onProfit = computeCommission(
  { ...base, model: "percentage_of_gross_profit", ratePct: 10 },
  { salesValue: 5_000_000, grossProfit: 1_200_000 },
);
assert.equal(onProfit.amount, 120_000, "paid on profit, not price");
// A loss-making deal must not produce a negative commission.
const onLoss = computeCommission(
  { ...base, model: "percentage_of_gross_profit", ratePct: 10 },
  { salesValue: 5_000_000, grossProfit: -400_000 },
);
assert.equal(onLoss.amount, 0, "a loss earns no commission rather than a negative one");
console.log("2. Percentage of gross profit pays on margin, and never goes negative");

const collected = computeCommission(
  { ...base, model: "percentage_of_collected_revenue", ratePct: 4 },
  { salesValue: 5_000_000, collectedRevenue: 3_000_000 },
);
assert.equal(collected.amount, 120_000, "paid on cash collected, not invoiced");
console.log(
  "3. Collected revenue basis: pays on 3,000,000 not 5,000,000 =",
  collected.amount.toLocaleString(),
);

const fixed = computeCommission(
  { ...base, model: "fixed_per_project", fixedAmount: 75_000 },
  { salesValue: 5_000_000 },
);
assert.equal(fixed.amount, 75_000);
console.log("4. Fixed per project:", fixed.amount.toLocaleString());

// Tiered, exactly the example in the specification.
const tiers = [
  { fromAmount: 0, toAmount: 1_000_000, ratePct: 2 },
  { fromAmount: 1_000_000, toAmount: 3_000_000, ratePct: 3 },
  { fromAmount: 3_000_000, toAmount: null, ratePct: 5 },
];
const marginal = computeCommission(
  { ...base, model: "tiered", tiers, tierMode: "marginal" },
  { salesValue: 5_000_000 },
);
// 1M@2% = 20,000 + 2M@3% = 60,000 + 2M@5% = 100,000 → 180,000
assert.equal(marginal.amount, 180_000, "each band charges only its own portion");
const flatTier = computeCommission(
  { ...base, model: "tiered", tiers, tierMode: "flat" },
  { salesValue: 5_000_000 },
);
assert.equal(flatTier.amount, 250_000, "flat mode charges the whole amount at the top band");
console.log(
  `5. Tiered on 5,000,000 — marginal ${marginal.amount.toLocaleString()}, flat ${flatTier.amount.toLocaleString()}`,
);
// A value inside the first band must not reach into higher bands.
const small = computeCommission(
  { ...base, model: "tiered", tiers, tierMode: "marginal" },
  { salesValue: 600_000 },
);
assert.equal(small.amount, 12_000, "600,000 @ 2%");

const underTarget = computeCommission(
  {
    ...base,
    model: "target_based",
    targetAmount: 4_000_000,
    belowTargetRatePct: 2,
    aboveTargetRatePct: 6,
  },
  { salesValue: 3_000_000 },
);
assert.equal(underTarget.amount, 60_000, "under target pays the base rate");
const overTarget = computeCommission(
  {
    ...base,
    model: "target_based",
    targetAmount: 4_000_000,
    belowTargetRatePct: 2,
    aboveTargetRatePct: 6,
  },
  { salesValue: 6_000_000 },
);
// 4M@2% = 80,000 + 2M@6% = 120,000 → 200,000
assert.equal(overTarget.amount, 200_000, "only the excess earns the accelerator");
console.log(
  "6. Target based: under =",
  underTarget.amount.toLocaleString(),
  "| over =",
  overTarget.amount.toLocaleString(),
);

// ── 2. Rule resolution: most specific wins ────────────────────────────────────
const rules: CommissionRule[] = [
  {
    id: "t",
    name: "Company default",
    model: "percentage_of_sales_value",
    scope: "tenant",
    ratePct: 2,
    active: true,
  },
  {
    id: "d",
    name: "Enterprise dept",
    model: "percentage_of_sales_value",
    scope: "department",
    scopeValue: "Sales",
    ratePct: 3,
    active: true,
  },
  {
    id: "e",
    name: "Top closer",
    model: "percentage_of_sales_value",
    scope: "employee",
    scopeValue: "emp-1",
    ratePct: 5,
    active: true,
  },
  {
    id: "p",
    name: "Strategic deal",
    model: "percentage_of_sales_value",
    scope: "project",
    scopeValue: "proj-9",
    ratePct: 1,
    active: true,
  },
];
assert.equal(resolveCommissionRule(rules, {})?.id, "t", "falls back to the tenant rule");
assert.equal(resolveCommissionRule(rules, { department: "Sales" })?.id, "d");
assert.equal(resolveCommissionRule(rules, { department: "Sales", employeeId: "emp-1" })?.id, "e");
assert.equal(
  resolveCommissionRule(rules, { department: "Sales", employeeId: "emp-1", projectId: "proj-9" })
    ?.id,
  "p",
  "a project rule beats an employee rule",
);
// An inactive rule must be skipped in favour of the next most specific.
const withInactive = rules.map((r) => (r.id === "e" ? { ...r, active: false } : r));
assert.equal(
  resolveCommissionRule(withInactive, { department: "Sales", employeeId: "emp-1" })?.id,
  "d",
);
console.log("7. Resolution order project > employee > role > department > category > tenant");

const noRule = commissionFor([], { employeeId: "x" }, { salesValue: 1_000_000 });
assert.equal(noRule.amount, 0, "no applicable rule means no commission");

// ── 3. Management allocation ──────────────────────────────────────────────────
const people: ManagementPerson[] = [
  {
    id: "ceo",
    name: "CEO",
    monthlyCost: 800_000,
    currency: "PKR",
    allocationPct: 5,
    basis: "project_revenue",
  },
  {
    id: "cto",
    name: "CTO",
    monthlyCost: 600_000,
    currency: "PKR",
    allocationPct: 15,
    basis: "resource_hours",
  },
  {
    id: "cfo",
    name: "CFO",
    monthlyCost: 500_000,
    currency: "PKR",
    allocationPct: 3,
    basis: "equal",
  },
  {
    id: "hr",
    name: "HR Lead",
    monthlyCost: 200_000,
    currency: "PKR",
    allocationPct: 0,
    basis: "equal",
  },
];

const pool = managementPoolSummary(people, "PKR");
// 800k*.05 + 600k*.15 + 500k*.03 + 0 = 40k + 90k + 15k = 145k
assert.equal(pool.allocatableMonthly, 145_000, "only the allocatable share reaches projects");
assert.equal(pool.totalMonthly, 2_100_000);
assert.equal(pool.unallocatedMonthly, 1_955_000, "the rest stays business overhead");
console.log(
  `8. Pool: ${pool.totalMonthly.toLocaleString()}/mo total, ${pool.allocatableMonthly.toLocaleString()} allocatable`,
);

const projects: ProjectWeight[] = [
  { projectId: "a", revenue: 6_000_000, cost: 4_000_000, durationMonths: 2, resourceHours: 900 },
  { projectId: "b", revenue: 2_000_000, cost: 1_500_000, durationMonths: 1, resourceHours: 300 },
];
const allocA = allocateManagementCost({
  people,
  project: projects[0]!,
  allProjects: projects,
  baseCurrency: "PKR",
  months: 1,
});
const allocB = allocateManagementCost({
  people,
  project: projects[1]!,
  allProjects: projects,
  baseCurrency: "PKR",
  months: 1,
});

// A person with 0% allocation must never appear.
assert.equal(
  allocA.lines.some((l) => l.personId === "hr"),
  false,
  "0% allocation is pure overhead",
);
// CEO by revenue: project A takes 6/8 of 40,000.
const ceoA = allocA.lines.find((l) => l.personId === "ceo");
assert.ok(Math.abs((ceoA?.amount ?? 0) - 30_000) < 0.01, "CEO share follows revenue");
// The pool is divided, never multiplied: A + B equals the allocatable total.
assert.ok(
  Math.abs(allocA.total + allocB.total - pool.allocatableMonthly) < 0.01,
  "allocating across projects must not invent cost",
);
console.log(
  `9. One month split: A ${Math.round(allocA.total).toLocaleString()} + B ${Math.round(allocB.total).toLocaleString()} = ${pool.allocatableMonthly.toLocaleString()}`,
);

// ── 4. Commission as cost, solved rather than iterated ────────────────────────
const inputs = {
  ...emptyInputs(null, "PKR"),
  projectName: "Commercial",
  phases: [
    {
      id: "p",
      name: "Delivery",
      allocations: [{ id: "a", employeeId: null, label: "Team", hours: 1000, hourlyCost: 2000 }],
    },
  ],
  contingencyPct: 10,
  pricingMode: "margin" as const,
  marginPct: 30,
  discountPct: 0,
  roundingStep: 0,
  salesCommissionPct: 3,
  managementAllocation: 200_000,
  operationalOverhead: 100_000,
};

const asDeduction = calculate({ ...inputs, commissionInCost: false });
const asCost = calculate({ ...inputs, commissionInCost: true });

// Management and overhead join the cost base before contingency.
assert.equal(asDeduction.subtotal, 2_000_000);
assert.equal(asDeduction.totalCost, (2_000_000 + 200_000 + 100_000) * 1.1);
assert.ok(asCost.price > asDeduction.price, "pricing commission in must raise the price");

// The margin target must actually be met once commission is a cost.
const achieved = ((asCost.price - asCost.totalCommercialCost) / asCost.price) * 100;
assert.ok(Math.abs(achieved - 30) < 0.01, `gross margin should be 30%, got ${achieved.toFixed(3)}`);
assert.ok(Math.abs(asCost.grossMarginPct - 30) < 0.01);
assert.ok(
  Math.abs(asCost.salesAcquisitionCost - asCost.price * 0.03) < 1,
  "commission is charged on the quoted price",
);
assert.equal(asDeduction.salesAcquisitionCost, 0, "as a deduction it stays out of cost");
console.log(
  `10. Commission as deduction: price ${Math.round(asDeduction.price).toLocaleString()} · ` +
    `as cost: price ${Math.round(asCost.price).toLocaleString()} with gross margin ${asCost.grossMarginPct.toFixed(1)}%`,
);

// Infeasible combinations are flagged, not silently priced at infinity.
const infeasible = calculate({
  ...inputs,
  commissionInCost: true,
  marginPct: 95,
  salesCommissionPct: 20,
});
assert.equal(infeasible.pricingInfeasible, true, "95% margin plus 20% commission cannot both hold");
assert.ok(Number.isFinite(infeasible.price) && infeasible.price > 0, "price stays a real number");
console.log(
  "11. A margin plus commission that cannot both be met is flagged, not priced at infinity",
);

// Backwards compatibility: with no management, overhead or commission-in-cost,
// the numbers must be identical to the previous behaviour.
const plain = calculate({
  ...emptyInputs(null, "PKR"),
  projectName: "Plain",
  phases: inputs.phases,
  contingencyPct: 10,
  pricingMode: "margin",
  marginPct: 30,
  discountPct: 0,
  roundingStep: 0,
});
assert.equal(plain.totalCost, 2_200_000);
assert.ok(Math.abs(plain.price - 2_200_000 / 0.7) < 0.01);
assert.equal(plain.totalCommercialCost, plain.totalCost);
console.log("12. Estimates without management or sales cost are unchanged");

console.log("\nALL COMMERCIAL ENGINE CHECKS PASSED");
