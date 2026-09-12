import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Calculator, LineChart, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CostCraft — Software Project Cost & Pricing Calculator" },
      {
        name: "description",
        content:
          "Turn salaries, overheads and team hours into a defensible project price. Contingency, margin, saved versions and side-by-side scenarios.",
      },
      { property: "og:title", content: "CostCraft — Software Cost & Pricing Calculator" },
      {
        property: "og:description",
        content: "Turn salaries, overheads and team hours into a defensible project price.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Users,
    title: "Know your true hourly cost",
    body: "Salaries, employer costs and overheads are spread across realistic billable hours — no guesswork.",
  },
  {
    icon: Calculator,
    title: "Guided estimate builder",
    body: "Phases, team hours, support, tools and contingency, step by step, with the price updating as you type.",
  },
  {
    icon: LineChart,
    title: "Compare and decide",
    body: "Save versions of an estimate and put scenarios side by side before you send the proposal.",
  },
  {
    icon: ShieldCheck,
    title: "Private per company",
    body: "Each company's numbers are locked to its own workspace, with roles and a full activity trail.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-primary font-display text-sm font-bold text-primary-foreground">
            ₵
          </span>
          <span className="font-display text-lg font-semibold">CostCraft</span>
        </div>
        <Button asChild size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-4 inline-flex rounded-full bg-accent/25 px-3 py-1 text-xs font-medium uppercase tracking-wide text-accent-foreground">
              For software teams and agencies
            </p>
            <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">
              Price software projects on real numbers, not gut feel.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground">
              CostCraft turns your salaries, overheads and planned team hours into a fully costed
              project — then adds contingency and the margin you actually want to earn.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">
                  Start free <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/guide">See how it works</Link>
              </Button>
            </div>
          </div>

          <Card className="border-2">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Example summary
              </p>
              <div className="mt-4 space-y-3 text-sm tabular">
                {[
                  ["Team hours", "1,240 h"],
                  ["Delivery cost", "62,000"],
                  ["Tools & licences", "3,400"],
                  ["Contingency 10%", "6,540"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
                <div className="flex items-baseline justify-between pt-2">
                  <span className="font-display text-sm font-semibold">Client price</span>
                  <span className="font-display text-2xl font-semibold">95,900</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Illustrative figures only — your workspace starts empty.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-t bg-secondary/60">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:px-6 md:grid-cols-2">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h2 className="font-display text-base font-semibold">{f.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground sm:px-6">
        CostCraft — software cost and pricing calculator.
      </footer>
    </div>
  );
}
