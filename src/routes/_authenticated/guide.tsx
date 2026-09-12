import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/_authenticated/guide")({
  head: () => ({
    meta: [
      { title: "How it works — CostCraft" },
      {
        name: "description",
        content: "Understand how hourly costs, contingency, margin and markup are calculated.",
      },
      { property: "og:title", content: "How it works — CostCraft" },
      { property: "og:description", content: "The maths behind every estimate, explained simply." },
    ],
  }),
  component: () => <WorkspaceGate>{() => <Guide />}</WorkspaceGate>,
});

const QA = [
  {
    q: "How is a person's hourly cost worked out?",
    a: "Take their yearly salary, add employer costs (taxes, benefits), add their share of monthly overheads, then divide by the hours they can realistically bill: working days × hours a day × billable target.",
  },
  {
    q: "What is contingency?",
    a: "A buffer added on top of estimated cost to cover things going longer than planned. 10% is a common starting point; raise it for uncertain work.",
  },
  {
    q: "Margin or markup — what's the difference?",
    a: "Markup is added on top of cost (cost + 35%). Margin is a share of the final price (price × 25% is profit). The same percentage gives a higher price with margin.",
  },
  {
    q: "Why does my price change when I change utilization?",
    a: "Lower billable targets mean fewer hours to spread salary and overheads across, so each billable hour costs more — and the price rises.",
  },
  {
    q: "Can I keep several versions of one estimate?",
    a: "Yes. Every save creates a new numbered version on the project, so nothing is overwritten and you can compare options side by side.",
  },
  {
    q: "Who can see our numbers?",
    a: "Only people in your company workspace. Salary figures and the cost policy are limited to Admin, Finance and Management; everyone else sees calculated hourly costs but never a salary. Every change is recorded in the activity trail.",
  },
  {
    q: "What can each role do?",
    a: "Admin: everything, including inviting people and changing roles. Finance: salaries, overheads and cost policy. Management: sees salaries and builds estimates. Project Manager and Technical Lead: build and edit estimates. Calculator User: builds estimates. Viewer: read-only.",
  },
  {
    q: "How do I add someone to the workspace?",
    a: "An Admin opens Company settings, Team tab, enters their email and picks a role. That creates a single-use link valid for 14 days. Send them the link; they sign in with that email address and accept or decline. Pending invitations can be resent or revoked at any time.",
  },
];

const ROADMAP = [
  [
    "AI team recommendations — deferred",
    "Suggesting a team mix and hours from a project description is intentionally not built yet. Roles, permissions and versioned estimates are being validated first, and any AI suggestion will arrive as an editable starting point you can accept or overwrite, never as a locked number.",
  ],
  [
    "Emailed invitations — needs a sending domain",
    "Invitations are created as secure single-use links you copy and send yourself. Automatic emails need a domain you own to be connected first.",
  ],
];

function Guide() {
  return (
    <>
      <PageHeader
        title="How it works"
        description="Plain-English explanations of every number in an estimate."
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-display text-base">The flow, end to end</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4 text-sm">
          {[
            ["1. People", "Add salaries, employer costs and billable targets."],
            ["2. Overheads & policy", "Shared costs, working hours, contingency and margin."],
            ["3. Estimate", "Plan phases, hours, support, tools and risk."],
            ["4. Price & save", "Review the breakdown, save a version, compare and share."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-md border p-3">
              <p className="font-medium">{t}</p>
              <p className="mt-1 text-muted-foreground">{d}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Accordion type="single" collapsible className="rounded-md border bg-card px-4">
        {QA.map((item) => (
          <AccordionItem key={item.q} value={item.q}>
            <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-display text-base">What is not built yet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {ROADMAP.map(([t, d]) => (
            <div key={t} className="rounded-md border p-3">
              <p className="font-medium">{t}</p>
              <p className="mt-1 text-muted-foreground">{d}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
