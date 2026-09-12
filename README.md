# CostCraft

CostCraft is a multi-tenant software project costing and pricing workspace for agencies and software teams. It converts people costs, employer burden, overheads, delivery hours, support, technology expenses, contingency, margin, markup, discounts, and commissions into defensible project estimates.

## Product Overview

CostCraft is built with React 19, TanStack Start, TanStack Router, Vite, Tailwind CSS, and Supabase. The active production data path is Supabase PostgreSQL with Supabase Auth and Row Level Security (RLS). A legacy local MySQL adapter remains available for development compatibility, but the default project configuration uses Supabase.

## Features

### Authentication and Workspaces

- Email/password sign in and account creation through Supabase Auth.
- Google OAuth support when the Google provider is enabled in Supabase.
- Invitation links for joining an existing workspace.
- Company/workspace setup with company name, industry, and base currency.
- Role-aware access for administrators, finance, management, project managers, technical leads, calculator users, and viewers.
- Company-scoped data isolation enforced by Supabase RLS policies.
- Activity/audit trail for important workspace changes.

### People and Salary Costing

- Employee records with name, title, department, seniority, skills, employment status, employer cost percentage, and billable target percentage.
- Monthly salary is the primary input.
- Annual salary is calculated automatically as monthly salary multiplied by 12.
- Salary currency selection, including PKR, AED, USD, GBP, EUR, SAR, CAD, AUD, INR, and QAR.
- Employee salary currency is retained while hourly costing converts it to the company base currency.
- Fully loaded hourly cost includes salary, employer burden, overhead allocation, working days, hours per day, utilization, and billable target.

### Overheads and Cost Policy

- Monthly or yearly overhead entries.
- Overhead categories and allocation across active employees.
- Working days per year and hours per day.
- Default utilization, contingency, target margin, markup, pricing mode, and rounding step.
- Yearly overheads are normalized to monthly values for reporting and annual costing.

### Guided Calculator

- Preset-based project scoping for MVP, mobile, web, CMS, e-commerce, SaaS, Laravel, design, and enterprise work.
- Project name, client, duration, duration unit, and per-team-group duration controls.
- Development, design, PM/QA, and leadership squad allocation.
- Synchronized or custom allocation percentages and durations.
- Project phases and team member assignment.
- Support retainers and support hours.
- Technology costs, monthly tools, one-off expenses, additional work, contingency, margin, markup, discount, sales commission, and rounding.
- Live cost and price summary with hourly, daily, weekly, and monthly breakdowns.
- Detailed cost waterfall and overhead absorption statement.
- Saved calculation versions and side-by-side scenario comparison.

### Dynamic Presets

- Built-in presets are available as a safe fallback.
- Workspace-managed presets are stored in the Supabase `project_presets` table.
- Import a JSON array of presets from Settings.
- Custom presets can override built-in preset IDs or add new IDs.
- Presets are shared across calculators for the workspace, not just one browser.
- Administrators and finance users can remove custom presets or reset to built-in defaults.

Example preset format:

```json
[
  {
    "id": "custom_saas",
    "category": "Startups & Custom",
    "badge": "Custom SaaS",
    "title": "Custom SaaS Platform",
    "description": "A workspace-managed SaaS delivery template.",
    "defaultDurationValue": 12,
    "defaultDurationUnit": "weeks",
    "suggestedRoles": [
      {
        "nameSubstr": "developer",
        "label": "Full-stack development",
        "allocationPct": 100
      }
    ],
    "techStack": []
  }
]
```

Valid duration units are `hours`, `days`, `weeks`, and `months`. Valid categories are `Mobile & Backend`, `CMS & E-Commerce`, `Design & Creatives`, and `Startups & Custom`.

### Dynamic Scope Feature Library

- Feature library with discovery, design, frontend, backend, mobile, e-commerce, integration, DevOps, testing, CMS, and social categories.
- Low, medium, and high complexity effort estimates by role.
- Scope selection by quantity and complexity.
- Drag-and-drop assignment into project phases.
- Workspace-specific custom feature records.
- JSON validation, import, export, sample templates, manual feature creation, and deletion.
- Features are stored in the Supabase `scope_features` table with company-aware RLS.

### Dashboards and Reports

- Monthly payroll burn and annual burn.
- Monthly and annual overhead totals.
- Cost by department.
- Average hourly cost and break-even monthly revenue.
- Team utilization and billable capacity.
- Project and calculation history.
- Activity trail with user, action, entity, and timestamp.
- Detailed project cost and pricing reports.

## Application Routes

### Public routes

- `/` - product landing page.
- `/auth` - email/password and Google sign-in.
- `/invite/:token` - invitation preview and acceptance.
- `/guide` - costing and pricing guidance.

### Authenticated routes

- `/dashboard` - company burn, payroll, overhead, team, and estimate metrics.
- `/calculator` - guided estimate builder and detailed calculation workflow.
- `/compare` - compare saved estimate versions and scenarios.
- `/projects` - project list and project creation.
- `/projects/:id` - project details, saved calculations, and reports.
- `/people` - employees, salary, currency, overhead allocation, and hourly cost.
- `/settings` - company, pricing policy, overheads, feature library, presets, and team settings.
- `/activity` - workspace audit trail.

## Architecture

```text
React / TanStack Router
        |
        v
Supabase client adapter
        |
        +--> Supabase Auth
        +--> Supabase PostgREST / RPC
        +--> Supabase PostgreSQL + RLS
```

The application imports its client from `src/integrations/supabase/client.ts`. The adapter selects the official Supabase client when `VITE_BACKEND=supabase`. A local MySQL-compatible API adapter is retained for compatibility, but it is disabled while Supabase is active.

## Requirements

- Node.js 20 or newer, or Bun 1.1 or newer.
- A Supabase project with Auth and PostgreSQL enabled.
- Supabase CLI 2.117 or newer for migration management.
- Google OAuth credentials if Google sign-in is required.

## Installation

```bash
npm install
# or
bun install
```

## Environment Variables

Copy the local environment template to `.env`. Never commit `.env`, publish secret keys, or expose server secrets through a `VITE_` variable.

### Supabase mode

```bash
VITE_BACKEND="supabase"
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_KEY="your-publishable-key"

# Server-only values. Keep these out of browser-exposed configuration.
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_PUBLISHABLE_KEY="your-publishable-key"
SUPABASE_SECRET_KEY="your-server-secret-key"
SUPABASE_JWKS_URL="https://your-project.supabase.co/auth/v1/.well-known/jwks.json"
```

### Local MySQL compatibility mode

```bash
VITE_BACKEND="local"
MYSQL_HOST="127.0.0.1"
MYSQL_PORT="3306"
MYSQL_USER="root"
MYSQL_PASSWORD=""
MYSQL_DATABASE="alisons_costcraft"

# Required only for the first local bootstrap; never commit these values.
COSTCRAFT_ADMIN_EMAIL="your-admin@example.com"
COSTCRAFT_ADMIN_PASSWORD="use-a-unique-password-at-least-12-characters"
COSTCRAFT_ADMIN_NAME="CostCraft Administrator"
```

The checked-in project `.env` is configured for the Supabase project used by this workspace. Replace credentials with deployment-specific secrets in CI, hosting, or local development.

## Supabase Setup and Database Sync

The repository uses imperative SQL migrations in `supabase/migrations/`. The migrations create and protect companies, profiles, roles, employees, overheads, policies, projects, calculations, audit logs, invitations, scope features, and project presets.

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase migration list --linked
npx supabase db push
```

For this workspace, the linked project ref is `qhlqptgvizefbecsotvf`. After changing schema or RLS, run:

```bash
npx supabase db advisors --linked --type all
```

The application expects the Supabase Data API to expose the `public` tables. RLS policies enforce company membership and role permissions; do not bypass RLS by using a secret key in browser code.

## Google OAuth Setup

1. Create a Google OAuth web application in Google Cloud.
2. In Supabase, open **Authentication > Providers > Google**.
3. Add the Google client ID and client secret.
4. Add the Supabase callback URL shown in the Supabase Auth provider settings to Google Cloud.
5. Add the application callback URL to Supabase redirect URLs:

```text
http://127.0.0.1:8082/auth
```

Use the deployed HTTPS application URL in production. Google sign-in is disabled until the provider is enabled in Supabase.

## Development

```bash
npm run dev
# or
bun run dev
```

Vite binds to localhost by default. If ports `8080` and `8081` are busy, Vite selects the next free port and prints the URL in the terminal.

## Available Commands

```bash
npm run dev                 # Start Vite development server
npm run build               # Create a production build
npm run build:dev           # Create a development-mode build
npm run preview             # Preview the production build (PORT=3000 by default)
npm run lint                # Run ESLint across the repository
npm run format              # Format the repository with Prettier
npm run db:init             # Initialize the legacy local MySQL schema
npm run db:test             # Exercise the legacy local API/database path
bun run scripts/verify-pricing.ts
bun run scripts/verify-team-adjustments.ts
```

## Verification Checklist

Before deployment:

1. Confirm `VITE_BACKEND=supabase` in the deployment environment.
2. Apply and verify all Supabase migrations.
3. Run Supabase advisors and review warnings.
4. Verify email sign-in, workspace creation, invitation acceptance, and Google OAuth if enabled.
5. Add an employee with a monthly salary and non-company salary currency.
6. Add monthly and yearly overheads and verify normalized totals.
7. Import a custom preset from Settings and verify it appears in both calculators.
8. Create a project, save a calculation version, compare versions, and inspect the activity trail.
9. Run `npm run build` and the pricing verification scripts.

## Security Notes

- `.env` and local secrets are ignored by Git.
- Publishable keys may be used in browser code; secret/server keys must remain server-only.
- Supabase RLS isolates workspace data.
- The active Supabase mode disables the legacy MySQL API routes.
- API and SSR responses include CSP, frame protection, content-type protection, referrer, and permissions headers.
- Login redirect targets are restricted to safe same-origin relative paths.
- Rotate any Supabase secret that has been exposed in chat, logs, backups, or public repositories.
- MySQL compatibility sessions use hashed server-side tokens and HttpOnly cookies; the browser stores only non-secret session metadata.
- Supabase browser sessions are scoped to `sessionStorage`; migrate to server-managed, HttpOnly, Secure, SameSite cookies before high-risk production use.

## Repository Structure

```text
src/
  components/             Reusable UI, calculator, people, and scope components
  integrations/supabase/  Supabase client, auth middleware, and generated database types
  lib/                    Pricing, currency, workspace, role, and utility logic
  routes/                 Public and authenticated TanStack routes
  server/                 API compatibility layer and server integration
supabase/
  migrations/             PostgreSQL schema, RLS, functions, indexes, and triggers
scripts/                  Local database and pricing verification scripts
public/                   Static public assets
```

## License

No license file is currently included. Add a license before distributing the repository publicly.
