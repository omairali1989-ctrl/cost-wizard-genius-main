import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgePercent,
  BookOpen,
  Bot,
  Building2,
  CloudCog,
  KanbanSquare,
  ReceiptText,
  SlidersHorizontal,
  UserCog,
  Users,
} from "lucide-react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SETTINGS_CARDS = [
  {
    to: "/settings/policy",
    label: "Cost & pricing policy",
    description: "Working time, utilization, contingency, margin and rounding.",
    icon: SlidersHorizontal,
  },
  {
    to: "/settings/overheads",
    label: "Overheads",
    description: "Classify and maintain the recurring costs shared across the team.",
    icon: ReceiptText,
  },
  {
    to: "/settings/ai-productivity",
    label: "AI productivity",
    description: "Set effort-reduction factors by estimate activity.",
    icon: Bot,
  },
  {
    to: "/settings/sales-commission",
    label: "Sales commission",
    description: "Manage commission models and matching rules.",
    icon: BadgePercent,
  },
  {
    to: "/settings/sales-process",
    label: "Sales process",
    description: "Customize pipeline stages and forecast probabilities.",
    icon: KanbanSquare,
  },
  {
    to: "/settings/sales-team",
    label: "Sales team",
    description: "Manage sellers, targets and assigned commission rules.",
    icon: Users,
  },
  {
    to: "/settings/feature-library",
    label: "Feature library & JSON",
    description: "Maintain reusable features and estimate presets.",
    icon: BookOpen,
  },
  {
    to: "/settings/connections",
    label: "Connections",
    description: "Connect approved assistants through remote MCP.",
    icon: CloudCog,
  },
  {
    to: "/settings/company",
    label: "Company",
    description: "Manage company identity and reporting currency.",
    icon: Building2,
  },
  {
    to: "/settings/team",
    label: "Team",
    description: "Invite people and manage workspace roles.",
    icon: UserCog,
  },
] as const;

export const Route = createFileRoute("/_authenticated/settings/")({
  head: () => ({
    meta: [{ title: "Company settings — CostCraft" }],
  }),
  component: SettingsIndexPage,
});

function SettingsIndexPage() {
  return (
    <>
      <SettingsPageHeader
        title="Company settings"
        description="Configure the assumptions, costs and workspace tools behind your estimates."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {SETTINGS_CARDS.map(({ to, label, description, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <Card className="h-full transition-colors group-hover:border-primary/50">
              <CardHeader className="flex-row items-start gap-3 space-y-0 pb-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <CardTitle className="font-display text-base">{label}</CardTitle>
                  <CardDescription className="mt-1">{description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-xs font-medium text-primary">
                Open settings →
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
