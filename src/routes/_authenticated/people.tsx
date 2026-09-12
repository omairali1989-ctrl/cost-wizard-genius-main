import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { PageHeader } from "@/components/AppShell";
import {
  useEmployees,
  useInvalidate,
  useOverheads,
  useTeamRates,
  logActivity,
} from "@/lib/workspace";
import {
  formatMoney,
  annualSalaryAmount,
  hourlyCostFor,
  overheadPerEmployeeAnnual,
  type EmployeeRecord,
} from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmployeeDialog } from "@/components/people/EmployeeDialog";
import { Field } from "@/components/ui/field";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/people")({
  head: () => ({
    meta: [
      { title: "People & costs — CostCraft" },
      {
        name: "description",
        content: "Manage your team, salaries, skills and the true hourly cost of each person.",
      },
      { property: "og:title", content: "People & costs — CostCraft" },
      { property: "og:description", content: "Manage salaries, skills and true hourly costs." },
    ],
  }),
  component: PeoplePage,
});

const blank = {
  name: "",
  job_title: "",
  department: "",
  seniority: "Mid",
  monthly_salary: 0,
  annual_salary: 0,
  salary_currency: "PKR",
  employer_cost_pct: 20,
  billable_target_pct: 75,
  skills: [] as string[],
  active: true,
};

function PeoplePage() {
  return <WorkspaceGate>{(ws) => <PeopleInner workspace={ws} />}</WorkspaceGate>;
}

function PeopleInner({ workspace }: { workspace: import("@/lib/workspace").WorkspaceData }) {
  if (!workspace.canViewFinance) return <TeamRatesOnly workspace={workspace} />;
  return <PeopleFinance workspace={workspace} />;
}

/** Salary-free team list for roles without finance access. */
function TeamRatesOnly({ workspace }: { workspace: import("@/lib/workspace").WorkspaceData }) {
  const currency = workspace.company!.currency;
  const { data: rates = [] } = useTeamRates(workspace.company!.id);
  return (
    <>
      <PageHeader
        title="Team"
        description="Hourly costs you can use in estimates. Salary figures are limited to Admin and Finance."
      />
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">People and hourly cost</CardTitle>
          <CardDescription>Internal cost per billable hour, before margin.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rates.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No people added yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead className="text-right">Hourly cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((r) => (
                  <TableRow key={r.id} className={r.active ? "" : "opacity-60"}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.job_title ?? "—"}
                      {r.seniority ? ` · ${r.seniority}` : ""}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(r.skills ?? []).slice(0, 4).map((s) => (
                          <Badge key={s} variant="secondary" className="text-[10px]">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular">
                      {formatMoney(r.hourly_cost, currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function PeopleFinance({ workspace }: { workspace: import("@/lib/workspace").WorkspaceData }) {
  const companyId = workspace.company!.id;
  const currency = workspace.company!.currency;
  const { data: employees = [] } = useEmployees(companyId);
  const { data: overheads = [] } = useOverheads(companyId);
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRecord | null>(null);
  const [form, setForm] = useState({ ...blank });

  const activeCount = employees.filter((e) => e.active).length;
  const ohPerEmployee = useMemo(
    () => overheadPerEmployeeAnnual(overheads, activeCount),
    [overheads, activeCount],
  );

  const startNew = () => {
    setEditing(null);
    setForm({ ...blank });
    setOpen(true);
  };

  const startEdit = (e: EmployeeRecord) => {
    setEditing(e);
    setForm({
      name: e.name,
      job_title: e.job_title ?? "",
      department: e.department ?? "",
      seniority: e.seniority ?? "Mid",
      monthly_salary: Number(e.monthly_salary || Number(e.annual_salary) / 12),
      annual_salary: Number(e.annual_salary),
      salary_currency: e.salary_currency || currency,
      employer_cost_pct: Number(e.employer_cost_pct),
      billable_target_pct: Number(e.billable_target_pct),
      skills: e.skills ?? [],
      active: e.active,
    });
    setOpen(true);
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const payload = {
      company_id: companyId,
      name: form.name,
      job_title: form.job_title || null,
      department: form.department || null,
      seniority: form.seniority || null,
      monthly_salary: Number(form.monthly_salary) || 0,
      annual_salary: (Number(form.monthly_salary) || 0) * 12,
      salary_currency: form.salary_currency || currency,
      employer_cost_pct: Number(form.employer_cost_pct) || 0,
      billable_target_pct: Number(form.billable_target_pct) || 0,
      skills: form.skills.map((skill) => skill.trim()).filter(Boolean),
      active: form.active,
    };
    const { error, data } = editing
      ? await supabase.from("employees").update(payload).eq("id", editing.id).select("id").single()
      : await supabase.from("employees").insert(payload).select("id").single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity(companyId, editing ? "updated" : "created", "employee", data?.id, {
      name: payload.name,
    });
    invalidate(["employees"]);
    setOpen(false);
    toast.success(editing ? "Person updated" : "Person added");
  };

  const remove = async (e: EmployeeRecord) => {
    const { error } = await supabase.from("employees").delete().eq("id", e.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity(companyId, "deleted", "employee", e.id, { name: e.name });
    invalidate(["employees"]);
    toast.success("Person removed");
  };

  return (
    <>
      <PageHeader
        title="People & costs"
        description="Salaries plus employer costs and a share of overheads, spread over realistic billable hours."
        action={
          workspace.canManageCosts ? (
            <Button onClick={startNew}>
              <Plus className="size-4" /> Add person
            </Button>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="People" value={String(employees.length)} hint={`${activeCount} active`} />
        <StatCard
          label="Overhead per person / year"
          value={formatMoney(ohPerEmployee, currency)}
          hint="Shared costs spread evenly"
        />
        <StatCard
          label="Average hourly cost"
          value={formatMoney(
            employees.length && workspace.policy
              ? employees.reduce(
                  (s, e) => s + hourlyCostFor(e, workspace.policy!, ohPerEmployee, currency),
                  0,
                ) / employees.length
              : 0,
            currency,
          )}
          hint="Internal cost, before margin"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Team</CardTitle>
          <CardDescription>
            Hourly cost is calculated from salary, employer costs, overheads and billable target.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {employees.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No people yet. Add your first team member to start costing projects.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead className="text-right">Salary</TableHead>
                  <TableHead className="text-right">Billable</TableHead>
                  <TableHead className="text-right">Hourly cost</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => (
                  <TableRow key={e.id} className={e.active ? "" : "opacity-60"}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.job_title ?? "—"}
                      {e.seniority ? ` · ${e.seniority}` : ""}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(e.skills ?? []).slice(0, 4).map((s) => (
                          <Badge key={s} variant="secondary" className="text-[10px]">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular">
                      <div>
                        {formatMoney(
                          Number(e.monthly_salary || Number(e.annual_salary) / 12),
                          e.salary_currency || currency,
                        )}{" "}
                        / mo
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatMoney(annualSalaryAmount(e), e.salary_currency || currency)} / yr
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular">{e.billable_target_pct}%</TableCell>
                    <TableCell className="text-right font-medium tabular">
                      {workspace.policy
                        ? formatMoney(
                            hourlyCostFor(e, workspace.policy, ohPerEmployee, currency),
                            currency,
                          )
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {workspace.canManageCosts && (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => startEdit(e)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => remove(e)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EmployeeDialog
        open={open}
        onOpenChange={setOpen}
        editing={!!editing}
        form={form}
        setForm={setForm}
        onSave={save}
      />
    </>
  );
}

export { Field } from "@/components/ui/field";
export { StatCard } from "@/components/ui/stat-card";
