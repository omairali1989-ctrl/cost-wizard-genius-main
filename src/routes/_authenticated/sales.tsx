import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  BadgeDollarSign,
  CalendarClock,
  KanbanSquare,
  Plus,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  costPerLead,
  DEFAULT_SALES_STAGES,
  LEAD_SOURCES,
  normalizedStages,
  safeNumber,
  type LeadAcquisitionCost,
  type SalesLead,
  type SalesProcessStage,
  type SalesTeamMember,
} from "@/lib/sales";
import { formatMoney } from "@/lib/pricing";
import { useInvalidate, type WorkspaceData } from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Sales hub — CostCraft" },
      {
        name: "description",
        content: "Manage your sales process, CRM pipeline and acquisition economics.",
      },
    ],
  }),
  component: () => (
    <WorkspaceGate>{(workspace) => <SalesHub workspace={workspace} />}</WorkspaceGate>
  ),
});

const today = new Date().toISOString().slice(0, 10);
const blankLead = {
  name: "",
  company_name: "",
  email: "",
  phone: "",
  source: "Website",
  stage: "New lead",
  owner_id: "none",
  estimated_value: 0,
  next_action: "",
  next_action_at: "",
  notes: "",
};
const blankCost = {
  period_start: today.slice(0, 8) + "01",
  source: "All channels",
  spend_amount: 0,
  leads_generated: 0,
  notes: "",
};

function SalesHub({ workspace }: { workspace: WorkspaceData }) {
  const companyId = workspace.company!.id;
  const currency = workspace.company!.currency;
  const canEdit = workspace.canEdit;
  const invalidate = useInvalidate();
  const [lead, setLead] = useState(blankLead);
  const [cost, setCost] = useState(blankCost);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: leads = [] } = useSalesQuery<SalesLead>(
    "sales-leads",
    companyId,
    "sales_leads",
    "created_at",
    false,
  );
  const { data: storedStages = [] } = useSalesQuery<SalesProcessStage>(
    "sales-process-stages",
    companyId,
    "sales_process_stages",
    "sort_order",
    true,
  );
  const { data: sellers = [] } = useSalesQuery<SalesTeamMember>(
    "sales-team-members",
    companyId,
    "sales_team_members",
    "name",
    true,
  );
  const { data: acquisitionCosts = [] } = useSalesQuery<LeadAcquisitionCost>(
    "lead-acquisition-costs",
    companyId,
    "lead_acquisition_costs",
    "period_start",
    false,
  );

  const stages = useMemo(
    () =>
      storedStages.length
        ? normalizedStages(storedStages)
        : DEFAULT_SALES_STAGES.map((stage, index) => ({
            ...stage,
            id: `default-${index}`,
            company_id: companyId,
            sort_order: index,
            active: true,
          })),
    [companyId, storedStages],
  );
  const stageMap = useMemo(() => new Map(stages.map((stage) => [stage.name, stage])), [stages]);
  const activeSellers = sellers.filter((seller) => seller.active !== false);
  const totalSpend = acquisitionCosts.reduce((sum, row) => sum + safeNumber(row.spend_amount), 0);
  const totalLeadsGenerated = acquisitionCosts.reduce(
    (sum, row) => sum + safeNumber(row.leads_generated),
    0,
  );
  const openLeads = leads.filter(
    (row) => !stageMap.get(row.stage)?.is_won && !stageMap.get(row.stage)?.is_lost,
  );
  const wonLeads = leads.filter((row) => stageMap.get(row.stage)?.is_won);
  const weightedPipeline = openLeads.reduce(
    (sum, row) =>
      sum +
      safeNumber(row.estimated_value) *
        (safeNumber(stageMap.get(row.stage)?.probability_pct) / 100),
    0,
  );
  const filteredLeads = leads.filter((row) =>
    `${row.name} ${row.company_name ?? ""} ${row.email ?? ""} ${row.source}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const sourceTotals = useMemo(() => {
    const totals = new Map<string, { spend: number; leads: number }>();
    acquisitionCosts.forEach((row) => {
      const current = totals.get(row.source) ?? { spend: 0, leads: 0 };
      current.spend += safeNumber(row.spend_amount);
      current.leads += safeNumber(row.leads_generated);
      totals.set(row.source, current);
    });
    return [...totals.entries()].sort((a, b) => b[1].spend - a[1].spend);
  }, [acquisitionCosts]);

  const write = async (
    action: () => Promise<{ error: { message: string } | null }>,
    keys: string[],
  ) => {
    setSaving(true);
    try {
      const result = await action();
      if (result.error) throw new Error(result.error.message);
      invalidate(keys);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save sales data");
    } finally {
      setSaving(false);
    }
  };

  const addLead = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!lead.name.trim()) {
      toast.error("Lead name is required.");
      return;
    }
    await write(
      () =>
        supabase.from("sales_leads").insert({
          ...lead,
          company_id: companyId,
          owner_id: lead.owner_id === "none" ? null : lead.owner_id,
          estimated_value: Math.max(0, safeNumber(lead.estimated_value)),
          next_action_at: lead.next_action_at || null,
          notes: lead.notes || null,
        } as never) as unknown as Promise<{ error: { message: string } | null }>,
      ["sales-leads"],
    );
    setLead({ ...blankLead, stage: stages[0]?.name ?? "New lead" });
  };

  const addCost = async (event: React.FormEvent) => {
    event.preventDefault();
    await write(
      () =>
        supabase.from("lead_acquisition_costs").insert({
          ...cost,
          company_id: companyId,
          spend_amount: Math.max(0, safeNumber(cost.spend_amount)),
          leads_generated: Math.max(0, Math.round(safeNumber(cost.leads_generated))),
        } as never) as unknown as Promise<{ error: { message: string } | null }>,
      ["lead-acquisition-costs"],
    );
    setCost(blankCost);
  };

  const patchLead = (id: string, patch: Record<string, unknown>) =>
    void write(
      () =>
        supabase
          .from("sales_leads")
          .update(patch as never)
          .eq("id", id) as unknown as Promise<{ error: { message: string } | null }>,
      ["sales-leads"],
    );
  const removeLead = (row: SalesLead) => {
    if (!confirm(`Delete ${row.name} from the CRM?`)) return;
    void write(
      () =>
        supabase.from("sales_leads").delete().eq("id", row.id) as unknown as Promise<{
          error: { message: string } | null;
        }>,
      ["sales-leads"],
    );
  };
  const removeCost = (row: LeadAcquisitionCost) => {
    if (!confirm(`Delete the ${row.source} acquisition record?`)) return;
    void write(
      () =>
        supabase.from("lead_acquisition_costs").delete().eq("id", row.id) as unknown as Promise<{
          error: { message: string } | null;
        }>,
      ["lead-acquisition-costs"],
    );
  };

  return (
    <>
      <PageHeader
        title="Sales hub"
        description="Run your sales process, manage leads and understand what it costs to create demand."
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/settings/sales-process">
              <Button variant="outline" size="sm">
                <KanbanSquare className="size-4" /> Process
              </Button>
            </Link>
            <Link to="/settings/sales-team">
              <Button variant="outline" size="sm">
                <Users className="size-4" /> Sales team
              </Button>
            </Link>
            <Link to="/settings/sales-commission">
              <Button variant="outline" size="sm">
                <BadgeDollarSign className="size-4" /> Commission rules
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Open leads"
          value={String(openLeads.length)}
          hint={`${wonLeads.length} won`}
          icon={Users}
        />
        <Metric
          label="Weighted pipeline"
          value={formatMoney(weightedPipeline, currency)}
          hint={`${formatMoney(
            openLeads.reduce((sum, row) => sum + safeNumber(row.estimated_value), 0),
            currency,
          )} unweighted`}
          icon={Target}
        />
        <Metric
          label="Acquisition spend"
          value={formatMoney(totalSpend, currency)}
          hint={`${totalLeadsGenerated} leads generated`}
          icon={BadgeDollarSign}
        />
        <Metric
          label="Cost per lead"
          value={
            totalLeadsGenerated
              ? formatMoney(costPerLead(totalSpend, totalLeadsGenerated), currency)
              : "—"
          }
          hint="Spend ÷ generated leads"
          icon={CalendarClock}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">CRM pipeline</CardTitle>
            <CardDescription>
              Add a lead, assign an owner and keep the next action visible.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {canEdit && (
              <form
                onSubmit={(event) => void addLead(event)}
                className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2"
              >
                <Input
                  required
                  placeholder="Lead or contact name"
                  value={lead.name}
                  onChange={(event) => setLead({ ...lead, name: event.target.value })}
                />
                <Input
                  placeholder="Company"
                  value={lead.company_name}
                  onChange={(event) => setLead({ ...lead, company_name: event.target.value })}
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={lead.email}
                  onChange={(event) => setLead({ ...lead, email: event.target.value })}
                />
                <Input
                  placeholder="Phone"
                  value={lead.phone}
                  onChange={(event) => setLead({ ...lead, phone: event.target.value })}
                />
                <Select
                  value={lead.source}
                  onValueChange={(source) => setLead({ ...lead, source })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={lead.stage} onValueChange={(stage) => setLead({ ...lead, stage })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.name}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  placeholder="Estimated value"
                  value={lead.estimated_value || ""}
                  onChange={(event) =>
                    setLead({ ...lead, estimated_value: Number(event.target.value) })
                  }
                />
                <Select
                  value={lead.owner_id}
                  onValueChange={(owner_id) => setLead({ ...lead, owner_id })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Owner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {activeSellers.map((seller) => (
                      <SelectItem key={seller.id} value={seller.id}>
                        {seller.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={lead.next_action_at}
                  onChange={(event) => setLead({ ...lead, next_action_at: event.target.value })}
                />
                <Input
                  placeholder="Next action"
                  value={lead.next_action}
                  onChange={(event) => setLead({ ...lead, next_action: event.target.value })}
                />
                <Textarea
                  className="sm:col-span-2"
                  placeholder="Notes"
                  value={lead.notes}
                  onChange={(event) => setLead({ ...lead, notes: event.target.value })}
                />
                <Button type="submit" disabled={saving} className="sm:col-span-2">
                  <Plus className="size-4" /> Add lead
                </Button>
              </form>
            )}
            <Input
              placeholder="Search leads"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {filteredLeads.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No leads match your search.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredLeads.map((row) => (
                  <div
                    key={row.id}
                    className="grid gap-3 rounded-lg border p-3 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.company_name || row.email || "No company or email"}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {row.source}
                        </Badge>
                        {row.next_action && (
                          <span className="text-[10px] text-muted-foreground">
                            Next: {row.next_action}
                          </span>
                        )}
                      </div>
                    </div>
                    <Select
                      disabled={!canEdit}
                      value={row.stage}
                      onValueChange={(stage) => patchLead(row.id, { stage })}
                    >
                      <SelectTrigger aria-label={`Stage for ${row.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.name}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      disabled={!canEdit}
                      value={row.owner_id ?? "none"}
                      onValueChange={(owner_id) =>
                        patchLead(row.id, { owner_id: owner_id === "none" ? null : owner_id })
                      }
                    >
                      <SelectTrigger aria-label={`Owner for ${row.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {activeSellers.map((seller) => (
                          <SelectItem key={seller.id} value={seller.id}>
                            {seller.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center justify-between gap-2 lg:justify-end">
                      <span className="text-sm font-medium tabular-nums">
                        {formatMoney(safeNumber(row.estimated_value), currency)}
                      </span>
                      {canEdit && (
                        <Button variant="ghost" size="icon" onClick={() => removeLead(row)}>
                          <Trash2 className="size-4" />
                          <span className="sr-only">Delete {row.name}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Lead acquisition cost</CardTitle>
            <CardDescription>
              Record campaign spend and generated leads to calculate cost per lead by source.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canEdit && (
              <form
                onSubmit={(event) => void addCost(event)}
                className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2"
              >
                <Input
                  type="month"
                  value={cost.period_start.slice(0, 7)}
                  onChange={(event) =>
                    setCost({ ...cost, period_start: `${event.target.value}-01` })
                  }
                />
                <Input
                  placeholder="Source"
                  value={cost.source}
                  onChange={(event) => setCost({ ...cost, source: event.target.value })}
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="Spend"
                  value={cost.spend_amount || ""}
                  onChange={(event) =>
                    setCost({ ...cost, spend_amount: Number(event.target.value) })
                  }
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="Leads generated"
                  value={cost.leads_generated || ""}
                  onChange={(event) =>
                    setCost({ ...cost, leads_generated: Number(event.target.value) })
                  }
                />
                <Input
                  className="sm:col-span-2"
                  placeholder="Notes (campaign, channel or period)"
                  value={cost.notes}
                  onChange={(event) => setCost({ ...cost, notes: event.target.value })}
                />
                <Button type="submit" disabled={saving} className="sm:col-span-2">
                  <Plus className="size-4" /> Add acquisition record
                </Button>
              </form>
            )}
            {sourceTotals.length > 0 && (
              <div className="space-y-2">
                {sourceTotals.map(([source, total]) => (
                  <div
                    key={source}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span>{source}</span>
                    <span className="tabular-nums">
                      {formatMoney(costPerLead(total.spend, total.leads), currency)} / lead{" "}
                      <span className="text-xs text-muted-foreground">({total.leads} leads)</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {acquisitionCosts.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                {acquisitionCosts.slice(0, 8).map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-medium">{row.source}</span>
                      <span className="ml-2 text-muted-foreground">{row.period_start}</span>
                    </div>
                    <div className="flex items-center gap-2 tabular-nums">
                      <span>
                        {formatMoney(safeNumber(row.spend_amount), currency)} ·{" "}
                        {safeNumber(row.leads_generated)} leads
                      </span>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => removeCost(row)}
                        >
                          <Trash2 className="size-3.5" />
                          <span className="sr-only">Delete acquisition record</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function useSalesQuery<T>(
  key: string,
  companyId: string,
  table: string,
  order: string,
  descending: boolean,
) {
  return useQuery<T[]>({
    queryKey: [key, companyId],
    queryFn: async () => {
      const result = await supabase
        .from(table)
        .select("*")
        .eq("company_id", companyId)
        .order(order, { ascending: !descending });
      if (result.error) {
        console.warn(`Unable to load ${table}:`, result.error.message);
        return [];
      }
      return (result.data ?? []) as T[];
    },
  });
}

function Metric({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Target;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 font-display text-xl font-semibold tabular-nums">{value}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
        </div>
        <Icon className="size-5 text-primary" />
      </CardContent>
    </Card>
  );
}
