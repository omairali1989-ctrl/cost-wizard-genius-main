# CostCraft Security Audit Report

## Executive summary

This was a repository-level static security audit of the TypeScript/Vite/TanStack Start application, including the Supabase migrations and legacy MySQL compatibility path. The remediation changes described below have now been applied. Production deployment still requires secret rotation and live Supabase/RLS verification.

The highest-risk issues are: a hardcoded Alisons administrator password in tracked source and test code; an unauthenticated legacy MySQL API if the backend mode is changed or omitted; and browser-persisted bearer tokens that are exposed to any XSS-capable script. The repository also contains detailed employee salary data in the database bootstrap source and prints sensitive salary data in the legacy test script.

No live credentials are reproduced in this report. Treat the previously seeded credential as compromised and rotate it immediately.

## Remediation status

The code fixes are applied in the working tree: bootstrap credentials are operator-provided and never reset; real personnel fixtures and sensitive test logging are removed; the MySQL path fails closed and enforces authenticated workspace/role checks; sessions use hashed server-side tokens and HttpOnly cookies; browser storage no longer contains MySQL bearer tokens; CSP removes script `unsafe-inline`/`unsafe-eval`; and explicit backend configuration is required.

Git history still contains the old credential and personnel data. Repository history cleanup and production credential rotation must be completed before treating the repository as clean.

## Scope and methodology

- Reviewed application source, server routes, auth/session handling, Supabase client configuration, SQL migrations/RLS, MySQL bootstrap/API code, build configuration, README and test scripts.
- Searched tracked source and generated artifacts for credentials, tokens, PII, salary data, dangerous sinks and authorization boundaries.
- Ran `npm run build`, `npm run lint`, and `npm audit --omit=dev --audit-level=moderate`.
- This audit did not run authenticated live penetration tests or Supabase database advisors because no live database session was established.

## Findings addressed

### SEC-001 — Hardcoded administrator credential and password reset behavior

**Impact:** Anyone with repository/history access can authenticate as the Alisons administrator in the legacy backend; every `db:init` run resets the account to the same known password.

**Evidence:** `scripts/init-mysql.ts:296-320` hardcodes the administrator email and plaintext password, hashes it during initialization, and updates an existing account. `scripts/test-api.ts:5-21` repeats the same credential. The credential was introduced in the initial commit and remains in Git history.

**Required remediation:** Remove plaintext credentials from source and history where practical, rotate/revoke the account immediately, require an operator-provided secret or one-time setup flow, and make initialization fail rather than reset an existing production administrator. Replace the test script with environment-provided credentials and never log access tokens.

### SEC-002 — Legacy MySQL API has no authorization on CRUD and several RPCs

**Impact:** If `VITE_BACKEND` is set to `local`, omitted, misconfigured, or the API is otherwise reachable, an unauthenticated caller can read or modify company data, employee salaries, projects, calculations, audit logs, invitations and roles. Several RPCs also lack authentication or admin checks.

**Evidence:** `src/server/api.ts:83-103` only disables the API when `VITE_BACKEND === "supabase"`; `src/server/api.ts:460-708` exposes generic query/insert/update/delete handlers without calling `getAuthUser`. `src/server/api.ts:243-454` allows `company_members` without auth, `set_member_role` and `remove_member` without admin authorization, `invitation_preview` without auth, and `decline_invitation` without auth or ownership checks. The fallback client is selected whenever Supabase mode is not active at `src/integrations/supabase/client.ts:338-348`.

**Required remediation:** Either remove the legacy API/client from deployable code or enforce authentication and company/role authorization on every route, server-side. Deny by default when backend configuration is missing; do not use a permissive MySQL fallback. Add integration tests for anonymous, cross-company, viewer, finance and admin access.

### SEC-003 — Long-lived bearer sessions persisted in `localStorage`

**Impact:** Any XSS or compromised third-party script running in the origin can read the session token and use it until expiry. The legacy token lasts 30 days.

**Evidence:** `src/integrations/supabase/client.ts:29-72` stores the complete session, including `access_token`, in `localStorage` and attaches it to every API request. `src/server/api.ts:131-138` and `195-202` issue 30-day tokens. `src/utils/supabase.ts:3-6` uses the standard browser Supabase client, which also persists browser sessions by default.

**Required remediation:** Prefer server-managed HttpOnly, Secure, SameSite cookies with appropriate session rotation and revocation. If browser storage must remain temporarily, shorten expiry, rotate refresh/access tokens, add CSP nonces instead of broad unsafe script directives, and document the residual risk.

## Remaining operational risks

### SEC-004 — Salary and employee personal data are committed to source and exposed by legacy diagnostics

`scripts/init-mysql.ts:337-500` contains employee names, roles and salary amounts. `scripts/test-api.ts:60-75` prints employee names and monthly salary values. This is sensitive personnel data and creates unnecessary exposure through source control, backups, logs and CI output.

**Remediation:** Remove real employee data from fixtures and history where possible, use synthetic records, load private seed data through a protected operator-only process, and redact salary/PII from test output.

### SEC-005 — CSP weakens XSS protection with `unsafe-inline` and `unsafe-eval`

`src/server.ts:15-16` permits both `script-src 'unsafe-inline'` and `script-src 'unsafe-eval'`. This materially reduces the value of the otherwise useful CSP and increases the impact of any injection issue, especially with localStorage tokens.

**Remediation:** Remove `unsafe-eval`; replace inline scripts with nonces or hashes and tighten `connect-src` to configured origins. Validate the resulting policy against the production build.

### SEC-006 — MySQL session tokens are stored in plaintext

`src/server/api.ts:131-138` stores the bearer token directly in `sessions.token`, and `src/server/api.ts:50-65` queries it directly. A database read leak immediately becomes session takeover.

**Remediation:** Store only a cryptographic hash of the session token, compare hashes server-side, add session metadata and revocation timestamps, and ensure expired sessions are cleaned up.

### SEC-007 — Client-side role checks are not an authorization boundary

The UI derives permissions from `roles` in `src/lib/workspace.ts:79-92`, but client-side checks can be bypassed. Supabase RLS is the effective production boundary and is generally company-scoped, but the legacy MySQL route does not replicate those checks (SEC-002). Any future server function must independently authorize using the authenticated principal, company membership and role.

## Medium findings and hardening notes

### SEC-008 — Generic CRUD accepts arbitrary columns and can return whole rows

`src/server/api.ts:468-526` allows `select: "*"` and `src/server/api.ts:602-619` returns inserted rows with `SELECT *`. The table allowlist helps, but it does not provide field-level minimization. This makes accidental exposure of future sensitive columns likely.

**Remediation:** Define per-table allowed read/write columns and response schemas; explicitly omit password hashes, tokens, internal metadata and sensitive fields.

### SEC-009 — Invitation tokens are placed in URLs and preview responses disclose invite email

`src/routes/invite.$token.tsx:35-56` uses the token in the URL and displays the invited email at lines 110-116. URL tokens can leak through browser history, screenshots, analytics, referrers or support logs.

**Remediation:** Use short-lived, single-use invitation tokens, avoid third-party resources on the invite page, set a strict `Referrer-Policy`, and minimize preview data. Keep the final email match and status/expiry checks server-side; the Supabase implementation does this more consistently than the MySQL fallback.

## Verification results

- `npm run build`: passed.
- `npm audit --omit=dev --audit-level=moderate`: passed with 0 reported vulnerabilities.
- `npx tsc --noEmit`: passed after repairing two pre-existing syntax errors.
- `npm run lint`: remains blocked by the repository's existing formatting and `any`-type backlog; the security changes add no runtime build failure.
- Public bundle scan did not find the seeded plaintext password or administrator email. Server artifacts include Supabase library documentation strings mentioning service-role keys, but no actual secret value was found.
- `.env` is ignored and not tracked, but it contains live-looking configuration values locally. Rotate any server secret that has ever been shared, logged or copied outside the protected environment.

## Recommended remediation order

1. Rotate the Alisons administrator password and any Supabase/MySQL secrets, including any values in local `.env` files.
2. Rewrite or purge the old credential/personnel data from Git history if repository policy permits.
3. Run authenticated cross-company/RLS tests and Supabase advisors against the linked project.
4. Resolve lint failures and add anonymous/cross-company role regression tests to CI.
