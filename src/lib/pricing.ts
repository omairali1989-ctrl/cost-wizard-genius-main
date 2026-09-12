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

export const HOURS_PER_DAY = 8;
export const HOURS_PER_WEEK = 40;
export const HOURS_PER_MONTH = 160;

export const unitToHours = (val: number, unit: TimeUnit, hoursPerDay = 8): number => {
  const v = Number(val) || 0;
  switch (unit) {
    case "days":
      return v * hoursPerDay;
    case "weeks":
      return v * hoursPerDay * 5;
    case "months":
      return v * 160;
    case "hours":
    default:
      return v;
  }
};

export const hoursToUnit = (hours: number, unit: TimeUnit, hoursPerDay = 8): number => {
  const h = Number(hours) || 0;
  switch (unit) {
    case "days":
      return Math.round((h / hoursPerDay) * 10) / 10;
    case "weeks":
      return Math.round((h / (hoursPerDay * 5)) * 10) / 10;
    case "months":
      return Math.round((h / 160) * 10) / 10;
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
}

export interface CalculationResults {
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

export const annualSalaryAmount = (employee: Pick<EmployeeRecord, "monthly_salary" | "annual_salary">): number => {
  const monthly = Number(employee.monthly_salary || 0);
  return monthly > 0 ? monthly * 12 : Number(employee.annual_salary || 0);
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
  const loaded = salary * (1 + Number(employee.employer_cost_pct || 0) / 100) + overheadPerEmployee;
  const utilization =
    (Number(employee.billable_target_pct) || Number(policy.default_utilization_pct) || 100) / 100;
  const billableHours =
    Number(policy.working_days_per_year || 0) * Number(policy.hours_per_day || 0) * utilization;
  if (billableHours <= 0) return 0;
  return loaded / billableHours;
};

export const roundTo = (value: number, step: number): number => {
  if (!step || step <= 0) return Math.round(value * 100) / 100;
  return Math.round(value / step) * step;
};

export const calculate = (input: CalculationInputs): CalculationResults => {
  const phaseBreakdown = input.phases.map((phase) => {
    const hours = phase.allocations.reduce((s, a) => s + Number(a.hours || 0), 0);
    const cost = phase.allocations.reduce(
      (s, a) => s + Number(a.hours || 0) * Number(a.hourlyCost || 0),
      0,
    );
    return { name: phase.name, hours, cost };
  });

  const totalHours = phaseBreakdown.reduce((s, p) => s + p.hours, 0);
  const laborCost = phaseBreakdown.reduce((s, p) => s + p.cost, 0);

  const supportHours = input.support.enabled
    ? Number(input.support.months || 0) * Number(input.support.hoursPerMonth || 0)
    : 0;
  const supportCost = supportHours * Number(input.support.hourlyCost || 0);

  const additionalCost = input.additionalWork.reduce((s, l) => s + Number(l.amount || 0), 0);
  const technologyCost = input.technology.reduce(
    (s, t) => s + Number(t.monthlyCost || 0) * Number(t.months || 0) + Number(t.oneOffCost || 0),
    0,
  );

  const subtotal = laborCost + supportCost + additionalCost + technologyCost;
  const contingencyAmount = subtotal * (Number(input.contingencyPct || 0) / 100);
  const totalCost = subtotal + contingencyAmount;

  let priceBeforeDiscount: number;
  if (input.pricingMode === "margin") {
    const m = Math.min(Number(input.marginPct || 0), 95) / 100;
    priceBeforeDiscount = m >= 1 ? totalCost : totalCost / (1 - m);
  } else {
    priceBeforeDiscount = totalCost * (1 + Number(input.markupPct || 0) / 100);
  }

  const discountAmount = priceBeforeDiscount * (Number(input.discountPct || 0) / 100);
  const price = roundTo(priceBeforeDiscount - discountAmount, Number(input.roundingStep || 0));
  const profit = price - totalCost;
  const marginPct = price > 0 ? (profit / price) * 100 : 0;
  const billableHours = totalHours + supportHours;
  const blendedRate = billableHours > 0 ? price / billableHours : 0;

  // Sales commission (e.g. for Ayesha)
  const salesCommissionPct = Number(input.salesCommissionPct || 0);
  const salesCommissionAmount = roundTo(price * (salesCommissionPct / 100), 1);
  const netProfitAfterCommission = profit - salesCommissionAmount;

  // Time unit rate breakdowns (8h/day, 40h/week, 160h/month)
  const costPerHour = billableHours > 0 ? totalCost / billableHours : 0;
  const costPerDay = costPerHour * HOURS_PER_DAY;
  const costPerWeek = costPerHour * HOURS_PER_WEEK;
  const costPerMonth = costPerHour * HOURS_PER_MONTH;

  const pricePerHour = blendedRate;
  const pricePerDay = pricePerHour * HOURS_PER_DAY;
  const pricePerWeek = pricePerHour * HOURS_PER_WEEK;
  const pricePerMonth = pricePerHour * HOURS_PER_MONTH;

  const totalDays = Math.round((billableHours / HOURS_PER_DAY) * 10) / 10;
  const totalWeeks = Math.round((billableHours / HOURS_PER_WEEK) * 10) / 10;
  const totalMonths = Math.round((billableHours / HOURS_PER_MONTH) * 10) / 10;

  return {
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
  if (!input.projectName.trim()) issues.push({ level: "error", message: "Give the project a name." });
  if (results.totalHours <= 0)
    issues.push({ level: "error", message: "Add at least some hours to the team plan." });
  input.phases.forEach((p) => {
    p.allocations.forEach((a) => {
      if (a.hourlyCost <= 0)
        issues.push({
          level: "warning",
          message: `"${a.label || "Unnamed role"}" in ${p.name} has no hourly cost — check salary and utilization settings.`,
        });
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
});
