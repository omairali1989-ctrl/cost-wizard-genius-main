import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CURRENCY_OPTIONS } from "@/lib/currency";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({
    meta: [
      { title: "Set up your company — CostCraft" },
      { name: "description", content: "Create your company workspace to start costing projects." },
      { property: "og:title", content: "Set up your company — CostCraft" },
      { property: "og:description", content: "Create your company workspace in CostCraft." },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: workspace, isLoading } = useWorkspace();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && workspace?.company) navigate({ to: "/dashboard", replace: true });
  }, [isLoading, workspace, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("create_company", {
      _name: name,
      _industry: industry,
      _currency: currency,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries();
    toast.success("Workspace ready");
    navigate({ to: "/people" });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-secondary px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="font-display">Set up your company</CardTitle>
          <CardDescription>
            This creates a private workspace. Only people you add can see its numbers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="company">Company name</Label>
              <Input id="company" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="industry">Industry (optional)</Label>
              <Input
                id="industry"
                placeholder="Software development agency"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={busy}>
              Create workspace
            </Button>
            <p className="text-xs text-muted-foreground">
              You&apos;ll start with sensible default settings — working days, utilization,
              contingency and margin — all editable later. No sample financial data is added.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
