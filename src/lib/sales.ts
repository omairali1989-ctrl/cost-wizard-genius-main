export const DEFAULT_SALES_STAGES = [
  { name: "New lead", probability_pct: 10, color: "slate", is_won: false, is_lost: false },
  { name: "Qualified", probability_pct: 25, color: "blue", is_won: false, is_lost: false },
  { name: "Proposal", probability_pct: 50, color: "amber", is_won: false, is_lost: false },
  { name: "Negotiation", probability_pct: 75, color: "violet", is_won: false, is_lost: false },
  { name: "Won", probability_pct: 100, color: "emerald", is_won: true, is_lost: false },
  { name: "Lost", probability_pct: 0, color: "rose", is_won: false, is_lost: true },
] as const;

export const LEAD_SOURCES = [
  "Website",
  "Referral",
  "LinkedIn",
  "Outbound",
  "Partner",
  "Event",
  "Other",
] as const;

export interface SalesProcessStage {
  id: string;
  company_id: string;
  name: string;
  sort_order: number;
  probability_pct: number;
  color: string;
  is_won: boolean;
  is_lost: boolean;
  active: boolean;
}

export interface SalesLead {
  id: string;
  company_id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  stage: string;
  owner_id: string | null;
  estimated_value: number;
  notes: string | null;
  next_action: string | null;
  next_action_at: string | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesTeamMember {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  role: string;
  target_amount: number;
  commission_rule_id: string | null;
  active: boolean;
}

export interface LeadAcquisitionCost {
  id: string;
  company_id: string;
  period_start: string;
  source: string;
  spend_amount: number;
  leads_generated: number;
  notes: string | null;
}

export const safeNumber = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export const costPerLead = (spend: number, leads: number): number =>
  leads > 0 ? Math.max(0, spend) / leads : 0;

export const normalizedStages = (stages: SalesProcessStage[]): SalesProcessStage[] =>
  stages.filter((stage) => stage.active !== false).sort((a, b) => a.sort_order - b.sort_order);
