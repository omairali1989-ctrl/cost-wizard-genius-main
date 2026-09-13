import { createFileRoute } from "@tanstack/react-router";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/settings/connections")({
  head: () => ({
    meta: [
      { title: "Connections — CostCraft" },
      { name: "description", content: "Connect assistants to CostCraft through remote MCP." },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      {() => (
        <>
          <SettingsPageHeader
            title="Connections"
            description="Connect supported assistants to your approved CostCraft workspace scope."
          />
          <McpConnectionCard />
        </>
      )}
    </WorkspaceGate>
  ),
});

function McpConnectionCard() {
  const endpoint = typeof window === "undefined" ? "/mcp" : `${window.location.origin}/mcp`;

  const copyEndpoint = async () => {
    await navigator.clipboard.writeText(endpoint);
    toast.success("MCP endpoint copied");
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-primary/[0.04]">
        <CardTitle className="font-display text-base">Connect Claude or ChatGPT</CardTitle>
        <CardDescription>
          Use CostCraft as a secure remote MCP connection for workspace-aware cost questions and
          approved actions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <div>
          <p className="mb-2 text-sm font-medium">Remote MCP endpoint</p>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
            <code className="min-w-0 flex-1 truncate px-2 text-sm">{endpoint}</code>
            <Button variant="outline" size="sm" onClick={() => void copyEndpoint()}>
              <Copy className="mr-1.5 size-4" /> Copy
            </Button>
          </div>
        </div>
        <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="mb-1 font-medium text-foreground">Claude</p>
            <p>Settings → Connectors → Add custom connector, then paste the endpoint.</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="mb-1 font-medium text-foreground">ChatGPT</p>
            <p>Developer mode → Create app, then use the endpoint and OAuth connection.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span>Each assistant gets your approved workspace scope.</span>
          <a
            className="inline-flex items-center gap-1 text-primary hover:underline"
            href="/mcp"
            target="_blank"
            rel="noreferrer"
          >
            Endpoint status <ExternalLink className="size-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
