import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCY_OPTIONS } from "@/lib/currency";
import { logActivity, useInvalidate, type WorkspaceData } from "@/lib/workspace";

export const Route = createFileRoute("/_authenticated/settings/company")({
  head: () => ({
    meta: [
      { title: "Company — CostCraft" },
      { name: "description", content: "Manage company identity and reporting currency." },
    ],
  }),
  component: () => <WorkspaceGate>{(ws) => <CompanyPage workspace={ws} />}</WorkspaceGate>,
});

function CompanyPage({ workspace }: { workspace: WorkspaceData }) {
  const companyId = workspace.company!.id;
  const invalidate = useInvalidate();
  const [company, setCompany] = useState({
    name: workspace.company!.name,
    industry: workspace.company!.industry ?? "",
    currency: workspace.company!.currency,
  });

  const saveCompany = async () => {
    const { error } = await supabase
      .from("companies")
      .update({
        name: company.name,
        industry: company.industry || null,
        currency: company.currency,
      })
      .eq("id", companyId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity(companyId, "updated", "company", companyId, {});
    invalidate(["workspace"]);
    toast.success("Company details saved");
  };

  return (
    <>
      <SettingsPageHeader
        title="Company"
        description="Manage the company details shown on proposals and reports."
      />
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Company details</CardTitle>
          <CardDescription>Shown on proposals and reports.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name">
            <Input
              disabled={!workspace.isAdmin}
              value={company.name}
              onChange={(event) => setCompany({ ...company, name: event.target.value })}
            />
          </Field>
          <Field label="Industry">
            <Input
              disabled={!workspace.isAdmin}
              value={company.industry}
              onChange={(event) => setCompany({ ...company, industry: event.target.value })}
            />
          </Field>
          <Field label="Currency" hint="Only currencies with a known exchange rate">
            <Select
              disabled={!workspace.isAdmin}
              value={company.currency}
              onValueChange={(currency) => setCompany({ ...company, currency })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {workspace.isAdmin && (
            <div className="sm:col-span-2">
              <Button onClick={saveCompany}>Save company</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
