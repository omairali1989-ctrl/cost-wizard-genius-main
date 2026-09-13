import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BadgePercent,
  Bot,
  Building2,
  Calculator,
  CircleDollarSign,
  CloudCog,
  FolderKanban,
  GaugeCircle,
  History,
  LibraryBig,
  LogOut,
  Menu,
  ReceiptText,
  Scale,
  SlidersHorizontal,
  BookOpen,
  ChartNoAxesCombined,
  Layers,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { roleLabel } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Perm = "always" | "edit" | "finance" | "admin";

const MAIN_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: GaugeCircle, perm: "always" },
  {
    to: "/business-intelligence",
    label: "Business intelligence",
    icon: ChartNoAxesCombined,
    perm: "always",
  },
  { to: "/calculator", label: "New estimate", icon: Calculator, perm: "edit" },
  { to: "/projects", label: "Projects", icon: FolderKanban, perm: "always" },
  { to: "/compare", label: "Compare scenarios", icon: Scale, perm: "always" },
  { to: "/people", label: "People & costs", icon: Users, perm: "finance" },
  { to: "/scope-blueprints", label: "Scope blueprints", icon: Layers, perm: "always" },
] as const satisfies readonly { to: string; label: string; icon: LucideIcon; perm: Perm }[];

const SETTINGS_NAV = [
  {
    to: "/settings/policy",
    label: "Cost & pricing policy",
    icon: SlidersHorizontal,
    perm: "always",
  },
  { to: "/settings/overheads", label: "Overheads", icon: ReceiptText, perm: "always" },
  { to: "/settings/ai-productivity", label: "AI productivity", icon: Bot, perm: "always" },
  {
    to: "/settings/sales-commission",
    label: "Sales commission",
    icon: BadgePercent,
    perm: "always",
  },
  {
    to: "/settings/feature-library",
    label: "Feature library & JSON",
    icon: LibraryBig,
    perm: "always",
  },
  { to: "/settings/connections", label: "Connections", icon: CloudCog, perm: "always" },
  { to: "/settings/company", label: "Company", icon: Building2, perm: "always" },
  { to: "/settings/team", label: "Team", icon: UserCog, perm: "admin" },
] as const satisfies readonly { to: string; label: string; icon: LucideIcon; perm: Perm }[];

const SUPPORT_NAV = [
  { to: "/activity", label: "Activity trail", icon: History, perm: "always" },
  { to: "/guide", label: "How it works", icon: BookOpen, perm: "always" },
] as const satisfies readonly { to: string; label: string; icon: LucideIcon; perm: Perm }[];

export function AppShell({ children }: { children: ReactNode }) {
  const { data: workspace } = useWorkspace();
  const allowed = (perm: Perm) => {
    if (perm === "always") return true;
    if (perm === "edit") return !!workspace?.canEdit;
    if (perm === "finance") return !!workspace?.canViewFinance;
    return !!workspace?.isAdmin;
  };
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const renderNavItems = (
    items: readonly { to: string; label: string; icon: LucideIcon; perm: Perm }[],
    compact = false,
  ) =>
    items
      .filter((item) => allowed(item.perm))
      .map((item) => {
        const Icon = item.icon;
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 text-sm transition-colors",
              compact ? "py-1.5" : "py-2",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      });

  const nav = (
    <nav className="flex flex-col gap-1">
      {renderNavItems(MAIN_NAV)}
      <div className="my-2 border-y border-sidebar-border py-2">
        <div className="mb-1 flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/55">
          <CircleDollarSign className="size-3.5" aria-hidden="true" />
          Company settings
        </div>
        <div className="flex flex-col gap-0.5">{renderNavItems(SETTINGS_NAV, true)}</div>
      </div>
      {renderNavItems(SUPPORT_NAV)}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col justify-between overflow-y-auto bg-sidebar p-4 lg:flex">
        <div>
          <Link to="/dashboard" className="mb-6 flex items-center gap-2 px-2">
            <span className="grid size-8 place-items-center rounded-md bg-sidebar-primary font-display text-sm font-bold text-sidebar-primary-foreground">
              ₵
            </span>
            <span className="font-display text-base font-semibold text-sidebar-foreground">
              CostCraft
            </span>
          </Link>
          {nav}
        </div>
        <div className="border-t border-sidebar-border pt-4 text-sidebar-foreground">
          <p className="truncate px-2 text-sm font-medium">{workspace?.company?.name}</p>
          <p className="truncate px-2 text-xs text-sidebar-foreground/60">{workspace?.email}</p>
          <div className="mt-2 flex flex-wrap gap-1 px-2">
            {workspace?.roles.map((r) => (
              <Badge key={r} variant="secondary" className="text-[10px]">
                {roleLabel(r)}
              </Badge>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="mt-3 w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
          <Button
            variant="outline"
            size="icon"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <Menu className="size-4" />
          </Button>
          <span className="font-display font-semibold">CostCraft</span>
        </header>
        {open && (
          <div className="border-b bg-sidebar p-4 lg:hidden">
            {nav}
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="mt-3 w-full justify-start text-sidebar-foreground/80"
            >
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        )}
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
