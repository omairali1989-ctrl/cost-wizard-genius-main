/**
 * Canonical Scope Blueprint catalogue.
 *
 * This file is a SEED SOURCE ONLY. The application never imports it — blueprints
 * are read from the database at runtime. It exists so the seed has one definition
 * that both the SQL migration and the live seeder are generated from.
 *
 * Two deliberate rules:
 *
 * 1. No person's name appears anywhere. Roles are matched by job title, department
 *    or skill, so a blueprint works in any workspace. The previous catalogue hard
 *    coded one company's staff, so every other tenant matched nobody.
 *
 * 2. Durations assume AI-assisted delivery. They are materially shorter than the
 *    traditional figures they replace and are meant to be read alongside the AI
 *    productivity matrix, not on top of it.
 */

export type PresetCategory =
  | "Mobile & Backend"
  | "CMS & E-Commerce"
  | "Design & Creatives"
  | "Startups & Custom"
  | "Business Systems"
  | "AI & Automation";

export type TimeUnit = "hours" | "days" | "weeks" | "months";

export type StackCategory =
  | "frontend"
  | "backend"
  | "mobile"
  | "database"
  | "design"
  | "qa"
  | "devops"
  | "management"
  | "other";

export interface SeedRole {
  /** Matched against job title, department, skills and finally name. Never a person. */
  nameSubstr: string;
  label: string;
  allocationPct: number;
}

export interface SeedStackItem {
  id: string;
  tech: string;
  category: StackCategory;
  suggestedEmployeeSubstr: string;
  roleLabel: string;
  allocationPct: number;
}

export interface SeedBlueprint {
  id: string;
  category: PresetCategory;
  badge: string;
  title: string;
  description: string;
  defaultDurationValue: number;
  defaultDurationUnit: TimeUnit;
  suggestedRoles: SeedRole[];
  techStack: SeedStackItem[];
}

// Role match keywords — generic enough to hit a real employee in any workspace.
const LEAD = "tech lead";
const FULLSTACK = "full stack";
const BACKEND = "backend";
const FRONTEND = "frontend";
const MOBILE = "mobile";
const DESIGN = "designer";
const PM = "project manager";
const QA = "qa";
const DEVOPS = "devops";
const ANALYST = "business analyst";

/** Compact stack-item builder; ids are derived so they stay stable across seeds. */
const stack = (
  blueprintId: string,
  index: number,
  tech: string,
  category: StackCategory,
  role: string,
  roleLabel: string,
  allocationPct: number,
): SeedStackItem => ({
  id: `st-${blueprintId}-${index}`,
  tech,
  category,
  suggestedEmployeeSubstr: role,
  roleLabel,
  allocationPct,
});

export const BLUEPRINT_CATALOGUE: SeedBlueprint[] = [
  {
    id: "mvp",
    category: "Startups & Custom",
    badge: "Startup MVP",
    title: "Startup MVP (Fast-Track)",
    description:
      "Prototype to market: core validation features, authentication, database and launch. Scoped for AI-assisted delivery.",
    defaultDurationValue: 3,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: LEAD, label: "Tech lead & architecture", allocationPct: 25 },
      { nameSubstr: FULLSTACK, label: "Full-stack developer", allocationPct: 100 },
      { nameSubstr: DESIGN, label: "UI/UX designer", allocationPct: 40 },
      { nameSubstr: PM, label: "Project manager", allocationPct: 20 },
      { nameSubstr: QA, label: "QA engineer", allocationPct: 25 },
    ],
    techStack: [
      stack("mvp", 1, "React & Next.js", "frontend", FULLSTACK, "Web application", 45),
      stack("mvp", 2, "Node.js API", "backend", FULLSTACK, "REST API", 35),
      stack("mvp", 3, "PostgreSQL", "database", FULLSTACK, "Schema & queries", 20),
      stack("mvp", 4, "Figma wireframes", "design", DESIGN, "Product UI", 40),
    ],
  },
  {
    id: "saas",
    category: "Startups & Custom",
    badge: "SaaS Platform",
    title: "SaaS Application (Multi-Tenant)",
    description:
      "Multi-tenant SaaS with subscription billing, role-based access, tenant isolation, admin console and usage reporting.",
    defaultDurationValue: 8,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: LEAD, label: "Tech lead & architecture", allocationPct: 40 },
      { nameSubstr: BACKEND, label: "Backend developer", allocationPct: 100 },
      { nameSubstr: FRONTEND, label: "Frontend developer", allocationPct: 100 },
      { nameSubstr: DESIGN, label: "UI/UX designer", allocationPct: 45 },
      { nameSubstr: QA, label: "QA engineer", allocationPct: 50 },
      { nameSubstr: PM, label: "Project manager", allocationPct: 30 },
    ],
    techStack: [
      stack("saas", 1, "React & TypeScript", "frontend", FRONTEND, "Application shell", 60),
      stack("saas", 2, "Node.js & tRPC", "backend", BACKEND, "Tenant-aware API", 50),
      stack("saas", 3, "PostgreSQL & RLS", "database", BACKEND, "Tenant isolation", 30),
      stack("saas", 4, "Stripe Billing", "backend", BACKEND, "Subscriptions & invoicing", 20),
      stack("saas", 5, "Design system", "design", DESIGN, "Component library", 45),
    ],
  },
  {
    id: "erp_crm",
    category: "Business Systems",
    badge: "ERP / CRM",
    title: "ERP / CRM Platform",
    description:
      "Customer and operations platform: pipeline, accounts, quotations, inventory or service modules, approvals and reporting.",
    defaultDurationValue: 10,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: LEAD, label: "Solution architect", allocationPct: 45 },
      { nameSubstr: ANALYST, label: "Business analyst", allocationPct: 50 },
      { nameSubstr: BACKEND, label: "Backend developer", allocationPct: 100 },
      { nameSubstr: FRONTEND, label: "Frontend developer", allocationPct: 90 },
      { nameSubstr: QA, label: "QA engineer", allocationPct: 60 },
      { nameSubstr: PM, label: "Project manager", allocationPct: 40 },
    ],
    techStack: [
      stack("erp", 1, "Laravel / .NET", "backend", BACKEND, "Domain & workflow engine", 60),
      stack("erp", 2, "React admin UI", "frontend", FRONTEND, "Module screens", 60),
      stack("erp", 3, "PostgreSQL / SQL Server", "database", BACKEND, "Relational model", 25),
      stack("erp", 4, "Reporting & exports", "backend", BACKEND, "Statements & reports", 15),
    ],
  },
  {
    id: "hrms",
    category: "Business Systems",
    badge: "HRMS",
    title: "HR Management System",
    description:
      "Employee records, attendance, leave, payroll inputs, appraisals, documents and self-service portal.",
    defaultDurationValue: 8,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: LEAD, label: "Tech lead", allocationPct: 35 },
      { nameSubstr: ANALYST, label: "Business analyst", allocationPct: 40 },
      { nameSubstr: BACKEND, label: "Backend developer", allocationPct: 100 },
      { nameSubstr: FRONTEND, label: "Frontend developer", allocationPct: 80 },
      { nameSubstr: QA, label: "QA engineer", allocationPct: 50 },
    ],
    techStack: [
      stack("hrms", 1, "Laravel", "backend", BACKEND, "HR domain & payroll inputs", 60),
      stack("hrms", 2, "React portal", "frontend", FRONTEND, "Employee self-service", 55),
      stack("hrms", 3, "MySQL", "database", BACKEND, "Records & audit", 25),
      stack("hrms", 4, "Role-based access", "backend", BACKEND, "Permissions", 15),
    ],
  },
  {
    id: "pos",
    category: "Business Systems",
    badge: "POS",
    title: "Point of Sale System",
    description:
      "Terminal sales, inventory, cash management, receipts, offline resilience and daily reconciliation reporting.",
    defaultDurationValue: 6,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: LEAD, label: "Tech lead", allocationPct: 30 },
      { nameSubstr: BACKEND, label: "Backend developer", allocationPct: 100 },
      { nameSubstr: FRONTEND, label: "Terminal UI developer", allocationPct: 90 },
      { nameSubstr: DESIGN, label: "UI/UX designer", allocationPct: 30 },
      { nameSubstr: QA, label: "QA engineer", allocationPct: 50 },
    ],
    techStack: [
      stack("pos", 1, "React terminal UI", "frontend", FRONTEND, "Sales screen", 60),
      stack("pos", 2, "Node.js API", "backend", BACKEND, "Sales & inventory", 55),
      stack("pos", 3, "Offline sync", "backend", BACKEND, "Local-first resilience", 25),
      stack("pos", 4, "Receipt & hardware", "other", BACKEND, "Printer & drawer", 15),
    ],
  },
  {
    id: "complaint_management",
    category: "Business Systems",
    badge: "Complaints",
    title: "Complaint Management System",
    description:
      "Ticket intake across channels, routing, SLA tracking, escalation, resolution workflow and satisfaction reporting.",
    defaultDurationValue: 4,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: ANALYST, label: "Business analyst", allocationPct: 30 },
      { nameSubstr: FULLSTACK, label: "Full-stack developer", allocationPct: 100 },
      { nameSubstr: DESIGN, label: "UI/UX designer", allocationPct: 30 },
      { nameSubstr: QA, label: "QA engineer", allocationPct: 40 },
    ],
    techStack: [
      stack("cms-comp", 1, "React portal", "frontend", FULLSTACK, "Agent & customer views", 50),
      stack("cms-comp", 2, "Workflow engine", "backend", FULLSTACK, "Routing & SLA", 35),
      stack("cms-comp", 3, "Notifications", "backend", FULLSTACK, "Email & SMS", 15),
    ],
  },
  {
    id: "booking_platform",
    category: "Business Systems",
    badge: "Booking",
    title: "Booking & Scheduling Platform",
    description:
      "Availability calendars, reservations, payments, reminders, cancellation rules and provider dashboards.",
    defaultDurationValue: 6,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: LEAD, label: "Tech lead", allocationPct: 25 },
      { nameSubstr: BACKEND, label: "Backend developer", allocationPct: 100 },
      { nameSubstr: FRONTEND, label: "Frontend developer", allocationPct: 85 },
      { nameSubstr: DESIGN, label: "UI/UX designer", allocationPct: 40 },
      { nameSubstr: QA, label: "QA engineer", allocationPct: 40 },
    ],
    techStack: [
      stack("book", 1, "Next.js booking flow", "frontend", FRONTEND, "Search & checkout", 55),
      stack("book", 2, "Availability engine", "backend", BACKEND, "Slots & conflicts", 50),
      stack("book", 3, "Payments", "backend", BACKEND, "Deposits & refunds", 25),
      stack("book", 4, "Reminders", "backend", BACKEND, "Email & SMS", 15),
    ],
  },
  {
    id: "marketplace",
    category: "CMS & E-Commerce",
    badge: "Marketplace",
    title: "Multi-Vendor Marketplace",
    description:
      "Vendor onboarding, catalogue, split payments, commissions, ratings, disputes and vendor payout reporting.",
    defaultDurationValue: 9,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: LEAD, label: "Tech lead & architecture", allocationPct: 40 },
      { nameSubstr: BACKEND, label: "Backend developer", allocationPct: 100 },
      { nameSubstr: FRONTEND, label: "Frontend developer", allocationPct: 100 },
      { nameSubstr: DESIGN, label: "UI/UX designer", allocationPct: 50 },
      { nameSubstr: QA, label: "QA engineer", allocationPct: 55 },
      { nameSubstr: PM, label: "Project manager", allocationPct: 30 },
    ],
    techStack: [
      stack("mkt", 1, "Next.js storefront", "frontend", FRONTEND, "Buyer experience", 55),
      stack("mkt", 2, "Vendor console", "frontend", FRONTEND, "Seller dashboard", 40),
      stack("mkt", 3, "Marketplace API", "backend", BACKEND, "Orders & commissions", 60),
      stack("mkt", 4, "Split payments", "backend", BACKEND, "Payouts & escrow", 30),
    ],
  },
  {
    id: "ecommerce_custom",
    category: "CMS & E-Commerce",
    badge: "E-Commerce",
    title: "Custom E-Commerce Platform",
    description:
      "Bespoke storefront, catalogue, cart, checkout, payment gateways, order management and fulfilment integration.",
    defaultDurationValue: 7,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: LEAD, label: "Tech lead", allocationPct: 30 },
      { nameSubstr: BACKEND, label: "Backend developer", allocationPct: 100 },
      { nameSubstr: FRONTEND, label: "Frontend developer", allocationPct: 100 },
      { nameSubstr: DESIGN, label: "UI/UX designer", allocationPct: 50 },
      { nameSubstr: QA, label: "QA engineer", allocationPct: 45 },
    ],
    techStack: [
      stack("ecom", 1, "Next.js storefront", "frontend", FRONTEND, "Catalogue & checkout", 65),
      stack("ecom", 2, "Commerce API", "backend", BACKEND, "Orders & inventory", 60),
      stack("ecom", 3, "Payment gateways", "backend", BACKEND, "Checkout integration", 25),
      stack("ecom", 4, "Storefront design", "design", DESIGN, "Brand & UI", 50),
    ],
  },
  {
    id: "shopify",
    category: "CMS & E-Commerce",
    badge: "Shopify",
    title: "Shopify E-Commerce Store",
    description:
      "Themed Shopify store with product setup, custom sections, app integrations, payments and launch support.",
    defaultDurationValue: 2,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: FRONTEND, label: "Shopify developer", allocationPct: 80 },
      { nameSubstr: DESIGN, label: "UI/UX designer", allocationPct: 60 },
      { nameSubstr: QA, label: "QA engineer", allocationPct: 25 },
      { nameSubstr: PM, label: "Project manager", allocationPct: 20 },
    ],
    techStack: [
      stack("shop", 1, "Shopify Liquid theme", "frontend", FRONTEND, "Theme & sections", 60),
      stack("shop", 2, "App integrations", "backend", FRONTEND, "Third-party apps", 20),
      stack("shop", 3, "Store design", "design", DESIGN, "Brand & merchandising", 60),
    ],
  },
  {
    id: "wordpress",
    category: "CMS & E-Commerce",
    badge: "WordPress",
    title: "WordPress Website & CMS",
    description:
      "Content-managed site with custom theme, editorial workflow, SEO foundations and performance tuning.",
    defaultDurationValue: 2,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: BACKEND, label: "WordPress developer", allocationPct: 70 },
      { nameSubstr: DESIGN, label: "UI/UX designer", allocationPct: 45 },
      { nameSubstr: QA, label: "QA engineer", allocationPct: 25 },
    ],
    techStack: [
      stack("wp", 1, "Custom theme", "frontend", BACKEND, "Templates & blocks", 55),
      stack("wp", 2, "Plugins & CMS setup", "backend", BACKEND, "Editorial workflow", 15),
      stack("wp", 3, "Site design", "design", DESIGN, "Pages & brand", 45),
    ],
  },
  {
    id: "corporate_website",
    category: "Design & Creatives",
    badge: "Corporate Site",
    title: "Corporate Website",
    description:
      "Marketing site with CMS-managed pages, contact capture, analytics, SEO and accessible responsive design.",
    defaultDurationValue: 2,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: FRONTEND, label: "Frontend developer", allocationPct: 70 },
      { nameSubstr: DESIGN, label: "UI/UX designer", allocationPct: 70 },
      { nameSubstr: QA, label: "QA engineer", allocationPct: 20 },
    ],
    techStack: [
      stack("corp", 1, "Next.js site", "frontend", FRONTEND, "Pages & CMS binding", 60),
      stack("corp", 2, "Headless CMS", "backend", FRONTEND, "Content model", 10),
      stack("corp", 3, "Brand & page design", "design", DESIGN, "Visual design", 70),
    ],
  },
  {
    id: "web_design",
    category: "Design & Creatives",
    badge: "UI/UX",
    title: "Web Design (UI/UX & Landing Page)",
    description:
      "Research-informed UI/UX for a landing page or product surface: wireframes, visual design and a handoff-ready system.",
    defaultDurationValue: 2,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: DESIGN, label: "UI/UX designer", allocationPct: 100 },
      { nameSubstr: FRONTEND, label: "Frontend developer", allocationPct: 30 },
      { nameSubstr: PM, label: "Project manager", allocationPct: 15 },
    ],
    techStack: [
      stack("wdes", 1, "Figma design system", "design", DESIGN, "Wireframes & UI", 100),
      stack("wdes", 2, "Prototype build", "frontend", FRONTEND, "Interactive handoff", 30),
    ],
  },
  {
    id: "social_creatives",
    category: "Design & Creatives",
    badge: "Creatives",
    title: "Social Media Design & Creatives",
    description:
      "Campaign creative set: post templates, ad variants, motion assets and a reusable brand kit.",
    defaultDurationValue: 2,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: DESIGN, label: "Creative designer", allocationPct: 100 },
      { nameSubstr: PM, label: "Account & coordination", allocationPct: 20 },
    ],
    techStack: [
      stack("soc", 1, "Creative templates", "design", DESIGN, "Post & ad sets", 70),
      stack("soc", 2, "Motion assets", "design", DESIGN, "Short-form video", 30),
    ],
  },
  {
    id: "mobile_mern",
    category: "Mobile & Backend",
    badge: "Mobile + Node",
    title: "Mobile App (Node.js Backend)",
    description:
      "Cross-platform mobile app with Node.js API, authentication, push notifications and store submission.",
    defaultDurationValue: 6,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: MOBILE, label: "Mobile developer", allocationPct: 100 },
      { nameSubstr: BACKEND, label: "Backend developer", allocationPct: 80 },
      { nameSubstr: DESIGN, label: "UI/UX designer", allocationPct: 45 },
      { nameSubstr: QA, label: "QA engineer", allocationPct: 45 },
      { nameSubstr: PM, label: "Project manager", allocationPct: 25 },
    ],
    techStack: [
      stack("mmern", 1, "React Native", "mobile", MOBILE, "iOS & Android app", 100),
      stack("mmern", 2, "Node.js API", "backend", BACKEND, "Mobile API", 60),
      stack("mmern", 3, "MongoDB", "database", BACKEND, "Data layer", 20),
      stack("mmern", 4, "App UI design", "design", DESIGN, "Screens & flows", 45),
    ],
  },
  {
    id: "mobile_laravel",
    category: "Mobile & Backend",
    badge: "Mobile + PHP",
    title: "Mobile App (Laravel Backend)",
    description:
      "Cross-platform mobile app with Laravel API, admin panel, authentication and store submission.",
    defaultDurationValue: 6,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: MOBILE, label: "Mobile developer", allocationPct: 100 },
      { nameSubstr: BACKEND, label: "Laravel developer", allocationPct: 80 },
      { nameSubstr: DESIGN, label: "UI/UX designer", allocationPct: 45 },
      { nameSubstr: QA, label: "QA engineer", allocationPct: 45 },
      { nameSubstr: PM, label: "Project manager", allocationPct: 25 },
    ],
    techStack: [
      stack("mlar", 1, "Flutter / React Native", "mobile", MOBILE, "iOS & Android app", 100),
      stack("mlar", 2, "Laravel API", "backend", BACKEND, "Mobile API & admin", 60),
      stack("mlar", 3, "MySQL", "database", BACKEND, "Data layer", 20),
      stack("mlar", 4, "App UI design", "design", DESIGN, "Screens & flows", 45),
    ],
  },
  {
    id: "mern",
    category: "Mobile & Backend",
    badge: "Web App",
    title: "Web Application / SaaS (Node.js)",
    description:
      "Full web application on a JavaScript stack: authentication, dashboards, integrations and deployment.",
    defaultDurationValue: 6,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: LEAD, label: "Tech lead", allocationPct: 30 },
      { nameSubstr: FULLSTACK, label: "Full-stack developer", allocationPct: 100 },
      { nameSubstr: DESIGN, label: "UI/UX designer", allocationPct: 40 },
      { nameSubstr: QA, label: "QA engineer", allocationPct: 40 },
      { nameSubstr: PM, label: "Project manager", allocationPct: 25 },
    ],
    techStack: [
      stack("mern", 1, "React & Next.js", "frontend", FULLSTACK, "Application UI", 55),
      stack("mern", 2, "Node.js API", "backend", FULLSTACK, "Services & auth", 45),
      stack("mern", 3, "MongoDB / PostgreSQL", "database", BACKEND, "Data layer", 30),
      stack("mern", 4, "UI design", "design", DESIGN, "Screens & system", 40),
    ],
  },
  {
    id: "laravel",
    category: "Mobile & Backend",
    badge: "Laravel",
    title: "Laravel Web Application & Portal",
    description:
      "Laravel application or customer portal: authentication, role-based modules, reporting and deployment.",
    defaultDurationValue: 6,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: LEAD, label: "Tech lead", allocationPct: 25 },
      { nameSubstr: BACKEND, label: "Laravel developer", allocationPct: 100 },
      { nameSubstr: FRONTEND, label: "Frontend developer", allocationPct: 60 },
      { nameSubstr: DESIGN, label: "UI/UX designer", allocationPct: 35 },
      { nameSubstr: QA, label: "QA engineer", allocationPct: 40 },
    ],
    techStack: [
      stack("lar", 1, "Laravel", "backend", BACKEND, "Domain & modules", 70),
      stack("lar", 2, "Blade / Livewire", "frontend", FRONTEND, "Portal UI", 50),
      stack("lar", 3, "MySQL", "database", BACKEND, "Schema & reports", 25),
    ],
  },
  {
    id: "api_integration",
    category: "Mobile & Backend",
    badge: "Integration",
    title: "API & Systems Integration",
    description:
      "Connect existing systems: API design, data mapping, sync jobs, error handling, retries and monitoring.",
    defaultDurationValue: 3,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: LEAD, label: "Integration architect", allocationPct: 35 },
      { nameSubstr: BACKEND, label: "Backend developer", allocationPct: 100 },
      { nameSubstr: QA, label: "QA engineer", allocationPct: 35 },
      { nameSubstr: DEVOPS, label: "DevOps engineer", allocationPct: 25 },
    ],
    techStack: [
      stack("api", 1, "API gateway & contracts", "backend", BACKEND, "Endpoints & schemas", 60),
      stack("api", 2, "Sync & queue workers", "backend", BACKEND, "Jobs & retries", 40),
      stack("api", 3, "Monitoring", "devops", DEVOPS, "Alerting & logs", 25),
    ],
  },
  {
    id: "ai_voice_agent",
    category: "AI & Automation",
    badge: "AI Voice",
    title: "AI Voice Agent",
    description:
      "Conversational voice agent: telephony integration, speech pipeline, intent handling, CRM hand-off and transcripts.",
    defaultDurationValue: 5,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: LEAD, label: "AI solution lead", allocationPct: 40 },
      { nameSubstr: BACKEND, label: "Backend / AI developer", allocationPct: 100 },
      { nameSubstr: FRONTEND, label: "Dashboard developer", allocationPct: 45 },
      { nameSubstr: QA, label: "QA engineer", allocationPct: 40 },
    ],
    techStack: [
      stack("voice", 1, "Speech & LLM pipeline", "backend", BACKEND, "STT, model, TTS", 60),
      stack("voice", 2, "Telephony integration", "backend", BACKEND, "Call handling", 25),
      stack("voice", 3, "Transcript dashboard", "frontend", FRONTEND, "Review & analytics", 45),
    ],
  },
  {
    id: "ai_automation",
    category: "AI & Automation",
    badge: "AI Automation",
    title: "AI / Workflow Automation",
    description:
      "Automate a business process with AI: document or data extraction, decision rules, human review and audit trail.",
    defaultDurationValue: 4,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: LEAD, label: "AI solution lead", allocationPct: 35 },
      { nameSubstr: BACKEND, label: "Backend / AI developer", allocationPct: 100 },
      { nameSubstr: ANALYST, label: "Business analyst", allocationPct: 35 },
      { nameSubstr: QA, label: "QA engineer", allocationPct: 35 },
    ],
    techStack: [
      stack("aiauto", 1, "Extraction & LLM pipeline", "backend", BACKEND, "Model workflow", 60),
      stack("aiauto", 2, "Review console", "frontend", BACKEND, "Human-in-the-loop", 25),
      stack("aiauto", 3, "Audit & reporting", "backend", BACKEND, "Traceability", 15),
    ],
  },
  {
    id: "enterprise",
    category: "Startups & Custom",
    badge: "Enterprise",
    title: "Enterprise Custom Software Suite",
    description:
      "Large multi-module platform: integrations, complex permissions, reporting, migration and phased rollout.",
    defaultDurationValue: 12,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: LEAD, label: "Solution architect", allocationPct: 60 },
      { nameSubstr: ANALYST, label: "Business analyst", allocationPct: 50 },
      { nameSubstr: BACKEND, label: "Backend developer", allocationPct: 100 },
      { nameSubstr: FRONTEND, label: "Frontend developer", allocationPct: 100 },
      { nameSubstr: MOBILE, label: "Mobile developer", allocationPct: 50 },
      { nameSubstr: QA, label: "QA engineer", allocationPct: 70 },
      { nameSubstr: DEVOPS, label: "DevOps engineer", allocationPct: 35 },
      { nameSubstr: PM, label: "Project manager", allocationPct: 50 },
    ],
    techStack: [
      stack("ent", 1, "Service architecture", "backend", BACKEND, "Domain services", 60),
      stack("ent", 2, "Web application", "frontend", FRONTEND, "Module UI", 60),
      stack("ent", 3, "Data platform", "database", BACKEND, "Model & migration", 25),
      stack("ent", 4, "CI/CD & environments", "devops", DEVOPS, "Pipelines", 35),
      stack("ent", 5, "Mobile companion", "mobile", MOBILE, "Field app", 50),
    ],
  },
  {
    id: "custom",
    category: "Startups & Custom",
    badge: "Custom",
    title: "Custom Fast Estimate",
    description:
      "Blank starting point for bespoke work. Add your own modules, features and team from scratch.",
    defaultDurationValue: 2,
    defaultDurationUnit: "weeks",
    suggestedRoles: [
      { nameSubstr: FULLSTACK, label: "Full-stack developer", allocationPct: 50 },
      { nameSubstr: DESIGN, label: "UI/UX designer", allocationPct: 25 },
    ],
    techStack: [],
  },
];

/** Guard: a person's allocations must never exceed the project timeline. */
export function validateCatalogue(list: SeedBlueprint[]): string[] {
  const problems: string[] = [];
  for (const bp of list) {
    const roleTotals = new Map<string, number>();
    for (const role of bp.suggestedRoles) {
      roleTotals.set(role.nameSubstr, (roleTotals.get(role.nameSubstr) ?? 0) + role.allocationPct);
    }
    const stackTotals = new Map<string, number>();
    for (const item of bp.techStack) {
      stackTotals.set(
        item.suggestedEmployeeSubstr,
        (stackTotals.get(item.suggestedEmployeeSubstr) ?? 0) + item.allocationPct,
      );
    }
    for (const [who, total] of [...roleTotals, ...stackTotals]) {
      if (total > 100) problems.push(`${bp.id}: "${who}" allocated ${total}%`);
    }
    if (!bp.suggestedRoles.length && bp.id !== "custom")
      problems.push(`${bp.id}: no suggested roles`);
  }
  return problems;
}
