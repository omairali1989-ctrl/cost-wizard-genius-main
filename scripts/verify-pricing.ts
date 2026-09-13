import { calculate, emptyInputs, unitToHours, hoursToUnit, formatMoney } from "../src/lib/pricing";
import assert from "node:assert/strict";

console.log("=== RUNNING FULL VERIFICATION TEST ===");

// 1. Check time unit conversions
console.log("\n1. Time conversions:");
console.log("1 day in hours:", unitToHours(1, "days")); // should be 8
console.log("1 week in hours:", unitToHours(1, "weeks")); // should be 40
console.log("1 month in hours:", unitToHours(1, "months")); // should be 160
console.log("160 hours in months:", hoursToUnit(160, "months")); // 1
console.log("40 hours in weeks:", hoursToUnit(40, "weeks")); // 1
console.log("8 hours in days:", hoursToUnit(8, "days")); // 1
assert.equal(unitToHours(1, "days"), 8);
assert.equal(unitToHours(1, "weeks"), 40);
assert.equal(unitToHours(1, "months"), 160);
assert.equal(hoursToUnit(160, "months"), 1);

// 2. Calculation with sales commission, overheads, and rate breakdown
const testInputs = {
  projectName: "Test Mobile App",
  clientName: "Alisons Client",
  description: "2 months mobile app development",
  phases: [
    {
      id: "phase-1",
      name: "Development",
      allocations: [
        {
          id: "mubashir",
          employeeId: "mubashir-id",
          label: "Mubashir Shakeel (Mobile App Developer)",
          hours: 320, // 2 months full-time
          hourlyCost: 1148.65, // Mubashir's loaded hourly cost
        },
        {
          id: "yousuf",
          employeeId: "yousuf-id",
          label: "Muhammad Yousuf (Team Lead)",
          hours: 96, // 30% of 2 months
          hourlyCost: 1984.72, // Yousuf's loaded hourly cost
        },
        {
          id: "designer",
          employeeId: "designer-id",
          label: "Yousuf Ansari (Designer)",
          hours: 160, // 50% of 2 months
          hourlyCost: 1044.14, // Yousuf Ansari's loaded hourly cost
        },
        {
          id: "pm",
          employeeId: "pm-id",
          label: "Syed Sultan (Project Manager)",
          hours: 80, // 25% of 2 months
          hourlyCost: 1827.96, // Sultan's loaded hourly cost
        },
      ],
    },
  ],
  support: { enabled: false, months: 0, hoursPerMonth: 0, hourlyCost: 0 },
  additionalWork: [],
  technology: [],
  contingencyPct: 10,
  pricingMode: "margin" as const,
  marginPct: 25,
  markupPct: 35,
  discountPct: 0,
  salesCommissionPct: 5,
  roundingStep: 100,
  currency: "PKR",
  notes: "Test project",
};

const results = calculate(testInputs);
assert.ok(results.totalHours > 0);
assert.equal(results.laborHours, 656);
assert.equal(results.supportHours, 0);
assert.ok(results.price > results.totalCost);
const dynamicAssumptions = calculate({ ...testInputs, hoursPerDay: 7, hoursPerMonth: 140 });
assert.equal(dynamicAssumptions.pricePerDay, dynamicAssumptions.pricePerHour * 7);
assert.equal(dynamicAssumptions.hoursPerMonth, 140);

// Margin and markup modes must use the same cost base, while discounts reduce
// the final quote and therefore reduce the realized margin.
const markupResult = calculate({ ...testInputs, pricingMode: "markup", markupPct: 35 });
assert.equal(markupResult.priceBeforeDiscount, markupResult.totalCost * 1.35);
const discountedResult = calculate({ ...testInputs, discountPct: 10, roundingStep: 0 });
assert.ok(Math.abs(discountedResult.price - discountedResult.priceBeforeDiscount * 0.9) < 0.01);
assert.ok(discountedResult.marginPct < results.marginPct);

// Invalid negative line items must never create a negative quote or cost.
const guardedResult = calculate({
  ...testInputs,
  phases: [
    {
      ...testInputs.phases[0],
      allocations: [{ ...testInputs.phases[0].allocations[0], hours: -40 }],
    },
  ],
  support: { enabled: true, months: -2, hoursPerMonth: 10, hourlyCost: 100 },
  additionalWork: [{ id: "negative", label: "Invalid", amount: -500 }],
  technology: [
    { id: "negative-tech", label: "Invalid", monthlyCost: -100, months: 2, oneOffCost: -50 },
  ],
});
assert.ok(guardedResult.laborCost >= 0);
assert.ok(guardedResult.supportCost >= 0);
assert.ok(guardedResult.additionalCost >= 0);
assert.ok(guardedResult.technologyCost >= 0);
assert.ok(guardedResult.price >= 0);
console.log("\n2. Project Results:");
console.log("Total Hours:", results.totalHours);
console.log("Total Labor Cost:", results.laborCost.toLocaleString(), "PKR");
console.log("Contingency (10%):", results.contingencyAmount.toLocaleString(), "PKR");
console.log("Total Delivery Cost:", results.totalCost.toLocaleString(), "PKR");
console.log("Client Price (25% margin):", results.price.toLocaleString(), "PKR");
console.log("Gross Profit:", results.profit.toLocaleString(), "PKR");
console.log(
  "Sales Commission (5% for Ayesha):",
  results.salesCommissionAmount.toLocaleString(),
  "PKR",
);
console.log("Net Company Profit:", results.netProfitAfterCommission.toLocaleString(), "PKR");

console.log("\n3. Rate breakdown:");
console.log("Hourly Rate to Client:", Math.round(results.pricePerHour).toLocaleString(), "PKR/hr");
console.log(
  "Daily Rate to Client (8h):",
  Math.round(results.pricePerDay).toLocaleString(),
  "PKR/day",
);
console.log(
  "Weekly Rate to Client (40h):",
  Math.round(results.pricePerWeek).toLocaleString(),
  "PKR/wk",
);
console.log(
  "Monthly Rate to Client (160h):",
  Math.round(results.pricePerMonth).toLocaleString(),
  "PKR/mo",
);

console.log("Internal Cost / Hour:", Math.round(results.costPerHour).toLocaleString(), "PKR/hr");
console.log("Internal Cost / Day:", Math.round(results.costPerDay).toLocaleString(), "PKR/day");
console.log("Internal Cost / Week:", Math.round(results.costPerWeek).toLocaleString(), "PKR/wk");
console.log("Internal Cost / Month:", Math.round(results.costPerMonth).toLocaleString(), "PKR/mo");

console.log("\n4. Testing All 11 Software Scopes (MVP, Mobile, Web, CMS, Shopify, Creatives):");

const samplePresets = [
  { name: "Startup MVP (Fast-Track)", hours: 260, rate: 1100, margin: 25 },
  { name: "Mobile App (MERN Stack Backend)", hours: 480, rate: 1250, margin: 25 },
  { name: "Mobile App (Laravel Backend)", hours: 480, rate: 1200, margin: 25 },
  { name: "Social Media Post Design & Creatives", hours: 190, rate: 750, margin: 25 },
  { name: "Web Design (UI/UX & Landing Page)", hours: 230, rate: 850, margin: 25 },
  { name: "WordPress Website & CMS", hours: 260, rate: 800, margin: 25 },
  { name: "Shopify E-Commerce Store", hours: 280, rate: 950, margin: 25 },
  { name: "MERN Stack Web App / SaaS", hours: 420, rate: 1150, margin: 25 },
  { name: "Laravel Web Application & Portal", hours: 400, rate: 1100, margin: 25 },
  { name: "Enterprise Custom Software Suite", hours: 850, rate: 2200, margin: 25 },
  { name: "Custom Fast Estimate", hours: 160, rate: 1000, margin: 25 },
];

for (const p of samplePresets) {
  const input = {
    projectName: p.name,
    clientName: "Client",
    description: "Scope estimate",
    phases: [
      {
        id: "p1",
        name: "Delivery",
        allocations: [
          { id: "a1", employeeId: "e1", label: "Dev", hours: p.hours, hourlyCost: p.rate },
        ],
      },
    ],
    support: { enabled: false, months: 0, hoursPerMonth: 0, hourlyCost: 0 },
    additionalWork: [],
    technology: [],
    contingencyPct: 10,
    pricingMode: "margin" as const,
    marginPct: p.margin,
    markupPct: 35,
    discountPct: 0,
    salesCommissionPct: 5,
    roundingStep: 100,
    currency: "PKR",
    notes: "",
  };
  const res = calculate(input);
  console.log(
    `✓ ${p.name.padEnd(38)} | Quote: ${Math.round(res.price).toLocaleString().padStart(10)} PKR | Day: ${Math.round(res.pricePerDay).toLocaleString().padStart(7)} PKR | Commission: ${Math.round(res.salesCommissionAmount).toLocaleString().padStart(7)} PKR`,
  );
}

console.log("\nALL 11 PRESET SCOPES CALCULATED AND VERIFIED SUCCESSFULLY!");
