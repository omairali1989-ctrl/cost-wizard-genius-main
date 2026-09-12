# CostCraft — Software Cost & Pricing Calculator

CostCraft is a standalone Software Development Cost & Pricing Calculator built with React 19, TanStack Start, TanStack Router, Vite, Tailwind CSS, and Supabase.

## Features

- **True Hourly Cost Calculation**: Spreads salaries, employer costs, and overheads across billable hours.
- **Guided Estimate Builder**: Phases, team hours, support, tools, and contingency with real-time price calculation.
- **Scenarios & Snapshots**: Compare versions and scenarios side-by-side.
- **Tenant Isolation**: Workspaces, roles, and activity tracking with Supabase PostgreSQL and RLS.

## Getting Started

### Prerequisites

- Node.js (>= 20) or Bun (>= 1.1)

### Installation

```bash
# Using bun:
bun install

# Or using npm:
npm install
```

### Environment Variables

The app supports both the local MySQL adapter and Supabase. Set `VITE_BACKEND` to `local` (the
default) or `supabase`:

```bash
VITE_BACKEND="local"
MYSQL_HOST="127.0.0.1"
MYSQL_PORT="3306"
MYSQL_USER="root"
MYSQL_PASSWORD=""
MYSQL_DATABASE="alisons_costcraft"
```

For Supabase mode, use:

```bash
VITE_BACKEND="supabase"
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_KEY="your-publishable-key"
```

To enable Google sign-in, configure Google under Supabase Dashboard > Authentication > Providers,
add the Google OAuth client ID and secret, and allow the app callback URL (for local development,
`http://127.0.0.1:8082/auth`).

### Development

```bash
# Run local dev server:
bun run dev

# Or with npm:
npm run dev
```

### Production Build

```bash
bun run build
# Or:
npm run build
```
