import { convertCurrency } from "@/lib/currency";

export type Currency = string;

export interface CostPolicy {
  working_days_per_year: number;
  hours_per_day: number;
  default_utilization_pct: number;
  default_contingency_pct: number;
  default_margin_pct: number;
  default_markup_pct: number;
  pricing_mode: "margin" | "markup" | string;
  rounding_step: number;
}

export interface EmployeeRecord {
  id: string;
  name: string;
  job_title: string | null;
  department: string | null;
  seniority: string | null;
  monthly_salary: number;
  annual_salary: number;
  salary_currency: string;
  employer_cost_pct: number;
  billable_target_pct: number;
  skills: string[];
  active: boolean;
}

export interface OverheadRecord {
  id: string;
  name: string;
  category: string | null;
  monthly_amount: number;
  period?: "monthly" | "yearly";
  allocation_basis: string;
}

export interface Allocation {
  id: string;
  employeeId: string | null;
  label: string;
  hours: number;
  hourlyCost: number;
  rateOverridden?: boolean;
}

export interface Phase {
  id: string;
  name: string;
  allocations: Allocation[];
}

export interface LineItem {
  id: string;
  label: string;
  amount: number;
}

export interface TechItem {
  id: string;
  label: string;
  monthlyCost: number;
  months: number;
  oneOffCost: number;
}

export type TimeUnit = "hours" | "days" | "weeks" | "months";

/** Highest margin the pricing formula honours, shared by every screen that quotes. */
export const MAX_MARGIN_PCT = 95;

export const HOURS_PER_DAY = 8;
export const HOURS_PER_WEEK = 40;
export const HOURS_PER_MONTH = 160;

export const unitToHours = (
  val: number,
  unit: TimeUnit,
  hoursPerDay = 8,
  hoursPerMonth = 160,
): number => {
  const v = Number(val) || 0;
  switch (unit) {
    case "days":
      return v * hoursPerDay;
    case "weeks":
      return v * hoursPerDay * 5;
    case "months":
      return v * hoursPerMonth;
    case "hours":
    default:
      return v;
  }
};

export const hoursToUnit = (
  hours: number,
  unit: TimeUnit,
  hoursPerDay = 8,
  hoursPerMonth = 160,
): number => {
  const h = Number(hours) || 0;
  switch (unit) {
    case "days":
      return Math.round((h / hoursPerDay) * 10) / 10;
    case "weeks":
      return Math.round((h / (hoursPerDay * 5)) * 10) / 10;
    case "months":
      return Math.round((h / hoursPerMonth) * 10) / 10;
    case "hours":
    default:
      return h;
  }
};

export interface CalculationInputs {
  projectName: string;
  clientName: string;
  description: string;
  phases: Phase[];
  support: { enabled: boolean; months: number; hoursPerMonth: number; hourlyCost: number };
  additionalWork: LineItem[];
  technology: TechItem[];
  contingencyPct: number;
  pricingMode: "margin" | "markup";
  marginPct: number;
  markupPct: number;
  discountPct: number;
  salesCommissionPct?: number;
  roundingStep: number;
  currency: string;
  notes: string;
  /** Workspace assumptions captured with the estimate so later policy changes do not rewrite history. */
  hoursPerDay?: number;
  hoursPerMonth?: number;
  /** Share of management time this project absorbs, already resolved to an amount. */
  managementAllocation?: number;
  /** Operational overhead charged to this project, already resolved to an amount. */
  operationalOverhead?: number;
  /** Treat sales commission as a cost before margin rather than a deduction from profit. */
  commissionInCost?: boolean;
}

export interface CalculationResults {
  /** Hours from phase allocations only; support hours are reported separately. */
  laborHours: number;
  /** Post-launch support hours included in the quote. */
  supportHours: number;
  totalHours: number;
  laborCost: number;
  supportCost: number;
  additionalCost: number;
  technologyCost: number;
  subtotal: number;
  contingencyAmount: number;
  totalCost: number;
  priceBeforeDiscount: number;
  discountAmount: number;
  price: number;
  profit: number;
  marginPct: number;
  blendedRate: number;
  salesCommissionPct: number;
  salesCommissionAmount: number;
  netProfitAfterCommission: number;
  managementAllocation: number;
  operationalOverhead: number;
  /** Commission counted inside cost; 0 when it is treated as a profit deduction. */
  salesAcquisitionCost: number;
  totalCommercialCost: number;
  grossProfit: number;
  grossMarginPct: number;
  /** True when margin plus commission could not both be met and the price was capped. */
  pricingInfeasible: boolean;
  // Time unit breakdown
  costPerHour: number;
  costPerDay: number;
  costPerWeek: number;
  costPerMonth: number;
  pricePerHour: number;
  pricePerDay: number;
  pricePerWeek: number;
  pricePerMonth: number;
  totalDays: number;
  totalWeeks: number;
  totalMonths: number;
  hoursPerDay: number;
  hoursPerWeek: number;
  hoursPerMonth: number;
  phaseBreakdown: { name: string; hours: number; cost: number }[];
}

export const overheadPerEmployeeAnnual = (
  overheads: OverheadRecord[],
  activeEmployeeCount: number,
): number => {
  if (activeEmployeeCount <= 0) return 0;
  const monthly = overheads.reduce((sum, o) => sum + monthlyOverheadAmount(o), 0);
  return (monthly * 12) / activeEmployeeCount;
};

export const monthlyOverheadAmount = (
  overhead: Pick<OverheadRecord, "monthly_amount" | "period">,
): number => {
  const amount = Number(overhead.monthly_amount || 0);
  return overhead.period === "yearly" ? amount / 12 : amount;
};

export const annualSalaryAmount = (
  employee: Pick<EmployeeRecord, "monthly_salary" | "annual_salary">,
): number => {
  const monthly = Number(employee.monthly_salary || 0);
  return monthly > 0 ? monthly * 12 : Number(employee.annual_salary || 0);
};

/** Number(), but a legitimate 0 survives — only null/undefined/NaN take the fallback. */
export const numOr = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const clampPct = (value: number, max = 100): number => Math.min(Math.max(value, 0), max);

/** Used only when a workspace has no utilization configured at all. */
export const DEFAULT_UTILIZATION_PCT = 75;

/**
 * Share of paid time that is billable, as a percentage.
 * `default_utilization_pct` is the workspace fallback used only when a person has
 * no target of their own — an explicit 0 means genuinely non-billable and is kept.
 */
export const billableSharePct = (
  employee: Pick<EmployeeRecord, "billable_target_pct">,
  policy: Pick<CostPolicy, "default_utilization_pct">,
): number => {
  const target = Number(employee.billable_target_pct);
  if (Number.isFinite(target)) return clampPct(target);
  return clampPct(numOr(policy.default_utilization_pct, DEFAULT_UTILIZATION_PCT));
};

/** Fully loaded internal cost of one billable hour for an employee. */
export const hourlyCostFor = (
  employee: EmployeeRecord,
  policy: CostPolicy,
  overheadPerEmployee: number,
  baseCurrency?: string,
): number => {
  const salary = convertCurrency(
    annualSalaryAmount(employee),
    employee.salary_currency || baseCurrency || "USD",
    baseCurrency || employee.salary_currency || "USD",
  );
  const employerCostPct = clampPct(numOr(employee.employer_cost_pct, 0), 200);
  // The overhead pool is divided across ACTIVE staff only, so giving an inactive
  // person a share would allocate more overhead than the company actually carries.
  const overheadShare = employee.active === false ? 0 : Math.max(numOr(overheadPerEmployee, 0), 0);
  const loaded = salary * (1 + employerCostPct / 100) + overheadShare;
  const billableHours =
    Number(policy.working_days_per_year || 0) *
    Number(policy.hours_per_day || 0) *
    (billableSharePct(employee, policy) / 100);
  if (billableHours <= 0) return 0;
  return loaded / billableHours;
};

export const roundTo = (value: number, step: number): number => {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const safeStep = Number(step);
  if (!Number.isFinite(safeStep) || safeStep <= 0) return Math.round(safeValue * 100) / 100;
  const rounded = Math.round(safeValue / safeStep) * safeStep;
  // A quote smaller than half the rounding step must not collapse to nothing.
  return safeValue > 0 && rounded <= 0 ? safeStep : rounded;
};

export const calculate = (input: CalculationInputs): CalculationResults => {
  const hoursPerDay = Math.min(Math.max(Number(input.hoursPerDay) || HOURS_PER_DAY, 1), 24);
  const hoursPerWeek = hoursPerDay * 5;
  const hoursPerMonth = Math.min(
    Math.max(Number(input.hoursPerMonth) || hoursPerDay * 20, hoursPerDay),
    hoursPerDay * 31,
  );
  const phaseBreakdown = input.phases.map((phase) => {
    const hours = phase.allocations.reduce((s, a) => s + Math.max(Number(a.hours) || 0, 0), 0);
    const cost = phase.allocations.reduce(
      (s, a) => s + Math.max(Number(a.hours) || 0, 0) * Math.max(Number(a.hourlyCost) || 0, 0),
      0,
    );
    return { name: phase.name, hours, cost };
  });

  const laborHours = phaseBreakdown.reduce((s, p) => s + p.hours, 0);
  const laborCost = phaseBreakdown.reduce((s, p) => s + p.cost, 0);

  const supportHours = input.support.enabled
    ? Math.max(Number(input.support.months) || 0, 0) *
      Math.max(Number(input.support.hoursPerMonth) || 0, 0)
    : 0;
  const supportCost = supportHours * Math.max(Number(input.support.hourlyCost) || 0, 0);

  const additionalCost = input.additionalWork.reduce(
    (s, l) => s + Math.max(Number(l.amount) || 0, 0),
    0,
  );
  const technologyCost = input.technology.reduce(
    (s, t) =>
      s +
      Math.max(Number(t.monthlyCost) || 0, 0) * Math.max(Number(t.months) || 0, 0) +
      Math.max(Number(t.oneOffCost) || 0, 0),
    0,
  );

  const subtotal = laborCost + supportCost + additionalCost + technologyCost;

  // Commercial cost structure: delivery cost carries its share of management time
  // and operational overhead before risk is added on top.
  const managementAllocation = Math.max(numOr(input.managementAllocation, 0), 0);
  const operationalOverhead = Math.max(numOr(input.operationalOverhead, 0), 0);
  const controllableCost = subtotal + managementAllocation + operationalOverhead;

  const contingencyPct = Math.min(Math.max(Number(input.contingencyPct) || 0, 0), 100);
  const contingencyAmount = controllableCost * (contingencyPct / 100);
  const totalCost = controllableCost + contingencyAmount;

  const salesCommissionPct = Math.min(Math.max(Number(input.salesCommissionPct) || 0, 0), 100);
  // Treating commission as cost is circular — it is a percentage of the very price
  // it helps determine — so solve for the price directly rather than iterating.
  //   margin:  p = cost / (1 - m - c)
  //   markup:  p = cost * (1 + u) / (1 - c * (1 + u))
  const commissionInCost = input.commissionInCost === true;
  const c = commissionInCost ? salesCommissionPct / 100 : 0;

  let priceBeforeDiscount: number;
  let pricingInfeasible = false;
  if (input.pricingMode === "margin") {
    const m = Math.min(Math.max(Number(input.marginPct) || 0, 0), MAX_MARGIN_PCT) / 100;
    const denominator = 1 - m - c;
    if (denominator <= 0) {
      // Margin plus commission would consume the whole price; fall back to the
      // highest feasible price rather than returning a negative or infinite one.
      pricingInfeasible = true;
      priceBeforeDiscount = totalCost / Math.max(1 - MAX_MARGIN_PCT / 100, 0.05);
    } else {
      priceBeforeDiscount = totalCost / denominator;
    }
  } else {
    const markup = Math.min(Math.max(Number(input.markupPct) || 0, 0), 1000);
    const uplift = 1 + markup / 100;
    const denominator = 1 - c * uplift;
    if (denominator <= 0) {
      pricingInfeasible = true;
      priceBeforeDiscount = totalCost * uplift;
    } else {
      priceBeforeDiscount = (totalCost * uplift) / denominator;
    }
  }

  const discountPct = Math.min(Math.max(Number(input.discountPct) || 0, 0), 100);
  const discountAmount = priceBeforeDiscount * (discountPct / 100);
  const price = roundTo(
    Math.max(priceBeforeDiscount - discountAmount, 0),
    Number(input.roundingStep || 0),
  );

  // Commission is always paid on the price actually quoted, discount included.
  const salesCommissionAmount = roundTo(price * (salesCommissionPct / 100), 1);
  const salesAcquisitionCost = commissionInCost ? salesCommissionAmount : 0;
  const totalCommercialCost = totalCost + salesAcquisitionCost;

  const profit = price - totalCost;
  const marginPct = price > 0 ? (profit / price) * 100 : 0;
  const grossProfit = price - totalCommercialCost;
  const grossMarginPct = price > 0 ? (grossProfit / price) * 100 : 0;

  const totalHours = laborHours + supportHours;
  const billableHours = totalHours;
  const blendedRate = billableHours > 0 ? price / billableHours : 0;

  const netProfitAfterCommission = profit - salesCommissionAmount;

  // Time unit rate breakdowns use the workspace assumptions captured on the estimate.
  const costPerHour = billableHours > 0 ? totalCost / billableHours : 0;
  const costPerDay = costPerHour * hoursPerDay;
  const costPerWeek = costPerHour * hoursPerWeek;
  const costPerMonth = costPerHour * hoursPerMonth;

  const pricePerHour = blendedRate;
  const pricePerDay = pricePerHour * hoursPerDay;
  const pricePerWeek = pricePerHour * hoursPerWeek;
  const pricePerMonth = pricePerHour * hoursPerMonth;

  const totalDays = Math.round((billableHours / hoursPerDay) * 10) / 10;
  const totalWeeks = Math.round((billableHours / hoursPerWeek) * 10) / 10;
  const totalMonths = Math.round((billableHours / hoursPerMonth) * 10) / 10;

  return {
    laborHours,
    supportHours,
    totalHours: billableHours,
    laborCost,
    supportCost,
    additionalCost,
    technologyCost,
    subtotal,
    contingencyAmount,
    totalCost,
    priceBeforeDiscount,
    discountAmount,
    price,
    profit,
    marginPct,
    blendedRate,
    salesCommissionPct,
    salesCommissionAmount,
    netProfitAfterCommission,
    managementAllocation,
    operationalOverhead,
    salesAcquisitionCost,
    totalCommercialCost,
    grossProfit,
    grossMarginPct,
    pricingInfeasible,
    costPerHour,
    costPerDay,
    costPerWeek,
    costPerMonth,
    pricePerHour,
    pricePerDay,
    pricePerWeek,
    pricePerMonth,
    totalDays,
    totalWeeks,
    totalMonths,
    hoursPerDay,
    hoursPerWeek,
    hoursPerMonth,
    phaseBreakdown,
  };
};

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
}

export const validateInputs = (
  input: CalculationInputs,
  results: CalculationResults,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  if (!input.projectName.trim())
    issues.push({ level: "error", message: "Give the project a name." });
  if (results.totalHours <= 0)
    issues.push({ level: "error", message: "Add at least some hours to the team plan." });
  if (input.contingencyPct < 0 || input.contingencyPct > 100)
    issues.push({ level: "error", message: "Contingency must be between 0% and 100%." });
  if (input.pricingMode === "margin" && (input.marginPct < 0 || input.marginPct > MAX_MARGIN_PCT))
    issues.push({
      level: "error",
      message: `Target margin must be between 0% and ${MAX_MARGIN_PCT}%.`,
    });
  if (input.pricingMode === "markup" && (input.markupPct < 0 || input.markupPct > 1000))
    issues.push({ level: "error", message: "Markup must be between 0% and 1000%." });
  if (input.discountPct < 0 || input.discountPct > 100)
    issues.push({ level: "error", message: "Discount must be between 0% and 100%." });
  if ((input.salesCommissionPct ?? 0) < 0 || (input.salesCommissionPct ?? 0) > 100)
    issues.push({ level: "error", message: "Sales commission must be between 0% and 100%." });
  input.phases.forEach((p) => {
    p.allocations.forEach((a) => {
      if (Number(a.hours) < 0)
        issues.push({
          level: "error",
          message: `Hours for "${a.label || "Unnamed role"}" cannot be negative.`,
        });
      if (Number(a.hourlyCost) < 0)
        issues.push({
          level: "error",
          message: `Hourly cost for "${a.label || "Unnamed role"}" cannot be negative.`,
        });
      if (a.hourlyCost <= 0)
        issues.push({
          level: "warning",
          message: `"${a.label || "Unnamed role"}" in ${p.name} has no hourly cost — check salary and utilization settings.`,
        });
    });
  });
  if (input.support.enabled) {
    if (Number(input.support.months) < 0)
      issues.push({ level: "error", message: "Support months cannot be negative." });
    if (Number(input.support.hoursPerMonth) < 0)
      issues.push({ level: "error", message: "Support hours per month cannot be negative." });
    if (Number(input.support.hourlyCost) < 0)
      issues.push({ level: "error", message: "Support hourly cost cannot be negative." });
  }
  input.additionalWork.forEach((item) => {
    if (Number(item.amount) < 0)
      issues.push({
        level: "error",
        message: `Additional work amount for "${item.label || "Unnamed item"}" cannot be negative.`,
      });
  });
  input.technology.forEach((item) => {
    if (Number(item.monthlyCost) < 0 || Number(item.months) < 0 || Number(item.oneOffCost) < 0)
      issues.push({
        level: "error",
        message: `Technology costs for "${item.label || "Unnamed item"}" cannot be negative.`,
      });
  });
  if (input.contingencyPct === 0)
    issues.push({ level: "warning", message: "No contingency added — risk is uncovered." });
  if (results.marginPct < 10)
    issues.push({ level: "warning", message: "Profit margin is below 10%." });
  if (input.discountPct > 20)
    issues.push({ level: "warning", message: "Discount above 20% heavily erodes profit." });
  return issues;
};

export const formatMoney = (value: number, currency = "USD"): string => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString()}`;
  }
};

export const emptyInputs = (policy?: CostPolicy | null, currency = "PKR"): CalculationInputs => ({
  projectName: "",
  clientName: "",
  description: "",
  phases: [
    { id: "init-phase-discovery", name: "Discovery & design", allocations: [] },
    { id: "init-phase-build", name: "Build", allocations: [] },
    { id: "init-phase-qa", name: "Testing & launch", allocations: [] },
  ],
  support: { enabled: false, months: 6, hoursPerMonth: 10, hourlyCost: 0 },
  additionalWork: [],
  technology: [],
  contingencyPct: Number(policy?.default_contingency_pct ?? 10),
  pricingMode: (policy?.pricing_mode === "markup" ? "markup" : "margin") as "margin" | "markup",
  marginPct: Number(policy?.default_margin_pct ?? 25),
  markupPct: Number(policy?.default_markup_pct ?? 35),
  discountPct: 0,
  salesCommissionPct: 5,
  roundingStep: Number(policy?.rounding_step ?? 100),
  currency,
  notes: "",
  hoursPerDay: Number(policy?.hours_per_day ?? HOURS_PER_DAY),
  hoursPerMonth:
    (Number(policy?.working_days_per_year ?? 240) *
      Number(policy?.hours_per_day ?? HOURS_PER_DAY)) /
    12,
});
