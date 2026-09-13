import { ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";

export function SettingsPageHeader({ title, description }: { title: string; description: string }) {
  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link to="/settings" className="transition-colors hover:text-foreground">
          Company settings
        </Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span className="text-foreground" aria-current="page">
          {title}
        </span>
      </nav>
      <PageHeader title={title} description={description} />
    </>
  );
}

export function SettingsReadOnlyNotice() {
  return (
    <p className="mb-4 rounded-md border border-accent bg-accent/15 px-3 py-2 text-sm">
      Salaries, overheads and pricing policy are limited to Admin and Finance. You can view what you
      have access to, but not change it.
    </p>
  );
}
