import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import {
  SettingsPageHeader,
  SettingsReadOnlyNotice,
} from "@/components/settings/SettingsPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  logActivity,
  useCommissionRules,
  useInvalidate,
  type WorkspaceData,
} from "@/lib/workspace";
import type { SalesTeamMember } from "@/lib/sales";

export const Route = createFileRoute("/_authenticated/settings/sales-team")({
  head: () => ({ meta: [{ title: "Sales team — CostCraft" }] }),
  component: () => (
    <WorkspaceGate>{(workspace) => <SalesTeamPage workspace={workspace} />}</WorkspaceGate>
  ),
});

function SalesTeamPage({ workspace }: { workspace: WorkspaceData }) {
  const companyId = workspace.company!.id;
  const canEdit = workspace.canEdit;
  const invalidate = useInvalidate();
  const { data: members = [] } = useQuery<SalesTeamMember[]>({
    queryKey: ["sales-team-members", companyId],
    queryFn: async () => {
      const result = await supabase
        .from("sales_team_members")
        .select("*")
        .eq("company_id", companyId)
        .order("name");
      if (result.error) throw result.error;
      return (result.data ?? []) as SalesTeamMember[];
    },
  });
  const { data: commissionRows = [] } = useCommissionRules(companyId);
  const [busy, setBusy] = useState(false);

  const write = async (action: () => Promise<{ error: { message: string } | null }>) => {
    setBusy(true);
    try {
      const result = await action();
      if (result.error) throw new Error(result.error.message);
      invalidate(["sales-team-members"]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save sales team");
    } finally {
      setBusy(false);
    }
  };

  const add = () =>
    void write(async () => {
      const result = await supabase.from("sales_team_members").insert({
        company_id: companyId,
        name: "New sales representative",
        role: "Sales representative",
      } as never);
      if (!result.error) await logActivity(companyId, "created", "sales_team_member", null, {});
      return result as { error: { message: string } | null };
    });

  const patch = (member: SalesTeamMember, changes: Record<string, unknown>) =>
    void write(async () => {
      const result = await supabase
        .from("sales_team_members")
        .update(changes as never)
        .eq("id", member.id);
      return result as { error: { message: string } | null };
    });

  const remove = (member: SalesTeamMember) => {
    if (!confirm(`Remove ${member.name} from the sales team? Leads will remain in the CRM.`))
      return;
    void write(async () => {
      const result = await supabase.from("sales_team_members").delete().eq("id", member.id);
      return result as { error: { message: string } | null };
    });
  };

  return (
    <>
      <SettingsPageHeader
        title="Sales team management"
        description="Maintain sellers, targets and the commission rule assigned to each person."
      />
      {!canEdit && <SettingsReadOnlyNotice />}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="font-display text-base">Sales roster</CardTitle>
              <CardDescription>
                Assign CRM leads to a seller and track target coverage from the Sales Hub.
              </CardDescription>
            </div>
            {canEdit && (
              <Button disabled={busy} onClick={add}>
                <Plus className="size-4" /> Add seller
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.length === 0 ? (
            <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No sales team members yet.
            </p>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1.4fr_1.2fr_1fr_1fr_1.4fr_auto] sm:items-center"
              >
                <Input
                  aria-label="Seller name"
                  disabled={!canEdit}
                  defaultValue={member.name}
                  onBlur={(event) =>
                    patch(member, { name: event.target.value.trim() || member.name })
                  }
                />
                <Input
                  aria-label={`Email for ${member.name}`}
                  type="email"
                  disabled={!canEdit}
                  defaultValue={member.email ?? ""}
                  placeholder="Email"
                  onBlur={(event) => patch(member, { email: event.target.value.trim() || null })}
                />
                <Input
                  aria-label={`Role for ${member.name}`}
                  disabled={!canEdit}
                  defaultValue={member.role}
                  onBlur={(event) =>
                    patch(member, { role: event.target.value.trim() || member.role })
                  }
                />
                <Input
                  aria-label={`Target for ${member.name}`}
                  type="number"
                  min={0}
                  disabled={!canEdit}
                  defaultValue={Number(member.target_amount)}
                  placeholder="Target"
                  onBlur={(event) =>
                    patch(member, { target_amount: Math.max(0, Number(event.target.value) || 0) })
                  }
                />
                <select
                  aria-label={`Commission rule for ${member.name}`}
                  disabled={!canEdit}
                  defaultValue={member.commission_rule_id ?? "none"}
                  onChange={(event) =>
                    patch(member, {
                      commission_rule_id: event.target.value === "none" ? null : event.target.value,
                    })
                  }
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="none">Workspace commission default</option>
                  {(commissionRows as Record<string, unknown>[]).map((rule) => (
                    <option key={String(rule["id"])} value={String(rule["id"])}>
                      {String(rule["name"] ?? "Commission rule")}
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={member.active}
                      onChange={(event) => patch(member, { active: event.target.checked })}
                    />{" "}
                    Active
                  </label>
                  {canEdit && (
                    <Button variant="ghost" size="icon" onClick={() => remove(member)}>
                      <Trash2 className="size-4" />
                      <span className="sr-only">Remove {member.name}</span>
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
