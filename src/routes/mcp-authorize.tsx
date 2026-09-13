import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ConsentSearch = {
  client_id?: string;
  client_name?: string;
  redirect_uri?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  resource?: string;
  scope?: string;
};

export const Route = createFileRoute("/mcp-authorize")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): ConsentSearch => {
    const result: ConsentSearch = {};
    for (const key of [
      "client_id",
      "client_name",
      "redirect_uri",
      "state",
      "code_challenge",
      "code_challenge_method",
      "resource",
      "scope",
    ] as const) {
      if (typeof search[key] === "string") result[key] = search[key] as string;
    }
    return result;
  },
  head: () => ({ meta: [{ title: "Connect assistant — CostCraft" }] }),
  component: McpAuthorizePage,
});

function McpAuthorizePage() {
  const search = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const returnPath = useMemo(() => `${window.location.pathname}${window.location.search}`, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        window.location.replace(`/auth?next=${encodeURIComponent(returnPath)}`);
        return;
      }
      setReady(true);
    });
  }, [returnPath]);

  const decline = () => {
    if (!search.redirect_uri) return;
    const redirect = new URL(search.redirect_uri);
    redirect.searchParams.set("error", "access_denied");
    redirect.searchParams.set("error_description", "The CostCraft connection was declined.");
    if (search.state) redirect.searchParams.set("state", search.state);
    window.location.assign(redirect.toString());
  };

  const approve = async () => {
    setBusy(true);
    setError(null);
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      window.location.replace(`/auth?next=${encodeURIComponent(returnPath)}`);
      return;
    }
    const response = await fetch("/oauth/authorize/complete", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(data.session.access_token
          ? { authorization: `Bearer ${data.session.access_token}` }
          : {}),
      },
      body: JSON.stringify(search),
    });
    const payload = (await response.json().catch(() => null)) as {
      redirect_url?: string;
      error_description?: string;
    } | null;
    if (!response.ok || !payload?.redirect_url) {
      setBusy(false);
      setError(payload?.error_description ?? "The connection could not be completed.");
      return;
    }
    window.location.assign(payload.redirect_url);
  };

  if (!ready) return <div className="grid min-h-screen place-items-center bg-secondary px-4" />;

  return (
    <div className="grid min-h-screen place-items-center bg-secondary px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-4">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <CardTitle className="font-display text-xl">Connect your CostCraft workspace</CardTitle>
            <CardDescription className="mt-2">
              {search.client_name || "An external assistant"} is requesting access to your
              workspace.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl border bg-muted/30 p-4 text-sm">
            <div className="mb-3 flex items-center gap-2 font-medium">
              <CheckCircle2 className="size-4 text-primary" />
              Access is scoped to your current workspace
            </div>
            <p className="text-muted-foreground">
              The assistant can read project estimates and, when its client supports confirmed write
              actions, use the CostCraft tools your role allows. Passwords and raw employee salaries
              are never shared.
            </p>
          </div>
          {error && (
            <p className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={decline} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void approve()} disabled={busy}>
              {busy ? "Connecting…" : "Approve connection"}
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
