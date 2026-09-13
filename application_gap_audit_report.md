# CostCraft Full Application Gap Audit

**Audit date:** 2026-09-12  
**Repository:** `cost-wizard-genius-main`  
**Production surface reviewed:** `https://cost-wizard-genius-main.vercel.app`  
**Audit type:** Read-only application, security, data-integrity, UX/accessibility, and deployment-readiness review

## Remediation update — 2026-09-12

The confirmed code and database remediations from this audit were implemented in the working tree and the linked Supabase project. Custom blueprint loading, atomic save/version allocation, financial policy boundaries, legacy API throttling/validation, safer imports, runtime CSP configuration, error states, accessibility labels, history completeness, and CI verification were addressed. The linked project has applied migrations through `20260912184606`.

Residual items requiring external product/configuration work are called out below: Supabase still reports leaked-password protection as disabled (the current project plan/settings did not accept the dashboard toggle), automatic invitation email delivery still needs a verified sending provider/domain, live FX rates need an approved source, and the existing repository-wide ESLint debt remains.

## Executive summary

The application builds and is reachable in production, but it is not yet ready to be treated as a fully verified production system. The most important gap is the custom project-blueprint flow: the manager loads workspace presets, while the calculator omits the company scope and therefore falls back to built-in presets. A blueprint can exist in the manager and still be absent from the calculator.

The next highest-risk gaps affect confidentiality and correctness:

- Financial tables and calculation results are readable by every authenticated company member under the current Supabase policies, while the application role model says salary and overhead data should be restricted to Admin, Finance, and Management.
- The legacy MySQL compatibility API has no login rate limiting, no local email verification, and no local forgot-password implementation.
- Saving a project and its calculation is a multi-request operation without a transaction; concurrent saves can also generate duplicate version numbers.
- Currency conversion is based on static exchange rates, and the local and Supabase calculation paths are not fully guaranteed to produce identical results.
- Automated quality gates are incomplete: the production build and TypeScript checks pass, but ESLint reports 1,281 errors and 13 warnings across 52 files, and there is no configured automated application test suite.

**Overall assessment: High remediation priority.** The core calculator is usable for a narrow, trusted admin workflow, but role isolation, persistence consistency, recovery flows, concurrency, and regression coverage need attention before broad rollout.

## Priority summary

| ID | Priority | Area | Finding | Status |
|---|---|---|---|---|
| GAP-001 | P0 | Blueprint correctness | Workspace project blueprints are not loaded by the calculator | Confirmed |
| GAP-002 | P0 | Data confidentiality | Financial data read policies are broader than the role model | Confirmed; verify against business policy |
| GAP-003 | P0 | Local authentication | MySQL compatibility mode lacks rate limiting, verification, and recovery | Confirmed; conditional on MySQL mode |
| GAP-004 | P0 | Save integrity | Project/calculation save is not transactional | Confirmed |
| GAP-005 | P1 | Version integrity | Concurrent saves can reuse the same version number | Confirmed |
| GAP-006 | P1 | Pricing accuracy | FX rates and time assumptions are hardcoded | Confirmed |
| GAP-007 | P1 | Deployment configuration | CSP is hardcoded to one Supabase origin | Confirmed |
| GAP-008 | P1 | Error recovery | Error-page retry uses an inline handler blocked by the CSP | Confirmed |
| GAP-009 | P1 | Data validation | Numeric and JSON business fields have weak database validation | Confirmed |
| GAP-010 | P1 | Import safety | Preset import deletes existing rows before inserting replacements | Confirmed |
| GAP-011 | P1 | Invitations | Invitation creation does not send email automatically | Confirmed / documented roadmap item |
| GAP-012 | P1 | Error states | Missing or inaccessible project details render without a useful error state | Confirmed |
| GAP-013 | P1 | Data completeness | Comparison and dashboard queries cap history without a user-visible completeness model | Confirmed |
| GAP-014 | P1 | Accessibility | Shared field labels are not associated with their controls | Confirmed |
| GAP-015 | P1 | Test coverage | No automated auth, RLS, role, workflow, or browser regression suite is configured | Confirmed |
| GAP-016 | P2 | Local API authorization | Local table reads are company-scoped but not role-scoped | Confirmed; conditional on MySQL mode |
| GAP-017 | P2 | Local API validation | Generic local writes accept arbitrary values with limited business validation | Confirmed; conditional on MySQL mode |
| GAP-018 | P2 | UI state | Search, filters, and comparison selection are not represented in the URL | Confirmed |
| GAP-019 | P2 | Observability | Async failures rely heavily on transient toasts and do not consistently expose inline/announced recovery | Confirmed pattern; needs screen-by-screen verification |
| GAP-020 | P2 | Runtime architecture | Authenticated routes are client-guarded with SSR disabled | Confirmed; data still requires backend authorization |
| GAP-021 | P2 | Repository hygiene | Historical audit notes prior credentials/PII in Git history; no license is included | Confirmed from repository documentation |
| GAP-022 | P2 | Web hardening | Robots allows all crawling and CSP retains broad/inline style allowances | Confirmed; low direct security impact |
| GAP-023 | P2 | Performance | Main client bundle is above the recommended large-chunk threshold | Confirmed |

## Detailed findings

### GAP-001 — Custom project blueprints do not reach the calculator

**Priority:** P0 — feature correctness  
**Evidence:** `src/routes/_authenticated/calculator.tsx:160-163` calls `usePresetLibrary()` without a company ID. `src/components/calculator/qce/presetLibrary.tsx:76-102` only queries `project_presets` when `companyId` is present and otherwise returns built-ins. The blueprint manager correctly calls `usePresetLibrary(companyId)` at `src/components/calculator/ProjectBlueprintManager.tsx:79`.

**Impact:** A user can create or see a workspace blueprint in the Blueprint Manager, but the calculator can still show only the built-in library. This is the confirmed root cause of the reported “created blueprints not visible” behavior.

**Recommendation:** Pass the active company ID into the calculator hook, add a loading/error state for the custom library, and add a browser regression test that creates a custom blueprint and selects it in both calculator entry points.

### GAP-002 — Financial read access is broader than the declared role model

**Priority:** P0 — confidentiality  
**Evidence:** The role policy at `src/lib/roles.ts:51-55` limits salary/overhead visibility to `admin`, `finance`, and `management`. The initial Supabase policies allow any authenticated company member to select `cost_policies` at `supabase/migrations/20260908071014_bacdd2f0-67a5-4dd7-9402-85e920d5c5e9.sql:236-240` and `calculations` at lines 248-252. Calculation results contain financial estimates and rate-derived values.

**Impact:** Project managers, technical leads, calculator users, or viewers may be able to query financial policy and calculation data that the UI role descriptions say they should not see. Workspace isolation is present, but intra-workspace least privilege is incomplete.

**Recommendation:** Decide the intended policy with the product owner, then enforce it in RLS and server-side reads. Add cross-role tests for every sensitive table and verify that UI hiding is backed by database denial, not only by rendering logic.

### GAP-003 — Local authentication is incomplete and brute-force resistant controls are absent

**Priority:** P0 — authentication/security  
**Evidence:** `src/server/api.ts:157-216` performs local login and bcrypt comparison without rate limiting, progressive delay, lockout, or abuse telemetry. `src/server/api.ts:219-275` creates a local account/session without email verification. `src/integrations/supabase/client.ts:294-320` explicitly returns unsupported errors for local OTP verification, resend, forgot-password, and password update flows.

**Impact:** MySQL compatibility mode does not provide the requested recovery and work-email verification behavior, and exposed login endpoints can be brute-forced. Supabase mode has a fuller recovery path, so this finding is conditional on the legacy backend being enabled or reachable.

**Recommendation:** Either remove/strictly isolate the legacy mode or implement equivalent controls: IP/account rate limits, generic auth errors, verified-email state, expiring reset tokens, one-time-use enforcement, audit events, and secure delivery through a configured email provider. Align cookie/session lifetimes; the local session is described as 30 days while the cookie is set to 8 hours at `src/server/api.ts:215`.

### GAP-004 — Save flow can leave partial data

**Priority:** P0 — data integrity  
**Evidence:** `src/routes/_authenticated/calculator.tsx:661-746` updates or inserts a project, then separately inserts a calculation and then logs activity. There is no transaction or compensating rollback.

**Impact:** A calculation insert or activity write can fail after a project was created or updated, leaving an orphan project or metadata that does not match the saved calculation. The UI can report the calculation failure after the project mutation already happened.

**Recommendation:** Move the operation behind a Postgres RPC or server endpoint that performs project upsert, calculation insert, version allocation, and audit logging in one transaction. Return the committed record and invalidate queries only after success.

### GAP-005 — Version allocation is race-prone

**Priority:** P1 — data integrity  
**Evidence:** The save flow reads the latest version at `src/routes/_authenticated/calculator.tsx:704-710`, calculates `last + 1` at line 711, and inserts that value at lines 717-725. The schema does not provide a unique `(project_id, version)` constraint.

**Impact:** Two tabs or users saving the same project at the same time can produce duplicate version numbers or inconsistent labels.

**Recommendation:** Allocate versions transactionally with a database function/sequence strategy and enforce uniqueness on `(project_id, version)`. Handle a uniqueness conflict with a retry and refresh.

### GAP-006 — Pricing inputs use static FX and fixed time assumptions

**Priority:** P1 — financial correctness  
**Evidence:** `src/lib/currency.ts:19-31` contains static exchange rates. `src/lib/pricing.ts:75-87` and `173-197` use fixed hours/day, hours/week, and 160 hours/month assumptions. The same static FX values are duplicated in the database migration `supabase/migrations/20260912100000_add_employee_salary_currency.sql`.

**Impact:** Multi-currency estimates can become stale, and monthly/annualized costs may not match a company’s working calendar, holidays, utilization policy, or contract assumptions. This is material wherever estimates are used for actual pricing or budgeting.

**Recommendation:** Make rate source, effective date, calendar, working days, and utilization explicit workspace settings. Snapshot those assumptions into each calculation version and display them in comparison/detail views. Add test cases for rate changes and non-default calendars.

### GAP-007 — CSP configuration is hardcoded to one Supabase project

**Priority:** P1 — deployment reliability/security  
**Evidence:** `src/server.ts:11-24` hardcodes `https://qhlqptgvizefbecsotvf.supabase.co` and its websocket origin. The browser client uses the environment-driven `VITE_SUPABASE_URL` at `src/integrations/supabase/client.ts:368-379`.

**Impact:** A deployment configured against a different Supabase project can fail authentication, database, or realtime requests because the CSP blocks the actual origin. Configuration can appear correct in the client while being rejected by the response headers.

**Recommendation:** Derive allowed origins from validated deployment configuration, fail closed when missing, and add a deployment smoke test that compares the runtime CSP with the configured Supabase URL.

### GAP-008 — Error-page retry is blocked by the strict CSP

**Priority:** P1 — recovery/security  
**Evidence:** `src/lib/error-page.ts:24` emits `onclick="location.reload()"`. `src/server.ts:21-23` uses nonce-based `script-src` without `unsafe-inline`. HTML event-handler attributes are not authorized by a script nonce.

**Impact:** When the server error page is rendered, the “Try again” action may do nothing, leaving the user without a recovery path.

**Recommendation:** Replace the inline handler with a normal link to the current location or attach a nonce-authorized script listener. Add an automated response/browser check for the error page.

### GAP-009 — Business data has weak database constraints

**Priority:** P1 — data integrity  
**Evidence:** Salary, employer-cost percentage, utilization/billable targets, overhead amounts, policy percentages, statuses, and preset JSON are mostly typed but not range-checked. The migration `supabase/migrations/20260912104059_project_presets.sql:1-24` stores unconstrained configuration JSON. The visible example of a business constraint is the overhead period check in `supabase/migrations/20260912090000_add_overhead_period.sql:5`.

**Impact:** Invalid negative salaries, out-of-range percentages, unsupported statuses, malformed preset shapes, and inconsistent currency/configuration values can enter through clients or compatibility APIs and contaminate future estimates.

**Recommendation:** Add database `CHECK` constraints and enums where appropriate, validate JSON against a versioned schema, normalize/round numeric inputs, and reject invalid values at the server boundary. Add migration tests for accepted and rejected values.

### GAP-010 — Preset import is destructive before it is safely replaceable

**Priority:** P1 — data integrity  
**Evidence:** `src/components/calculator/qce/presetLibrary.tsx:110-130` deletes matching preset IDs and then inserts replacements without a transaction. `src/components/scope-engine/FeatureLibraryManager.tsx:372-399` bulk-inserts feature data without transactional import behavior.

**Impact:** A failed insert, duplicate, malformed item, or network interruption after deletion can remove existing user data or leave a partial import.

**Recommendation:** Validate the full import before mutation, use an atomic upsert/RPC, keep an export/rollback option, and show per-item failures. Never delete the existing set until replacement validation succeeds.

### GAP-011 — Invitations are links, not emailed workflows

**Priority:** P1 — product completeness  
**Evidence:** `src/routes/_authenticated/guide.tsx:62-70` documents that invitations are copied and sent manually; automatic emails require a sending domain. `src/components/TeamSettings.tsx` creates invitation records and exposes links but does not send mail.

**Impact:** Team onboarding depends on a manual copy/send step and does not meet an email-template/OTP-style onboarding expectation. Tokens also need operational monitoring and revocation assurance.

**Recommendation:** Configure a verified sending domain/provider, send a templated invitation/verification email, record delivery status and failures, and keep single-use expiry/revocation enforced in the database.

### GAP-012 — Missing/inaccessible project detail has no actionable state

**Priority:** P1 — UX/reliability  
**Evidence:** `src/routes/_authenticated/projects.$id.tsx:37-50` does not surface either query error. Rendering is conditional on `results && inputs` at lines 83-196, so an invalid, deleted, or inaccessible project can show a generic “Project Estimate” shell without a not-found, permission, or retry message.

**Impact:** Users cannot tell whether a project is missing, restricted, still loading, or failed to load. Support diagnosis becomes harder and the user may retry unsafe actions.

**Recommendation:** Add explicit loading, not-found, permission-denied, and retry states. Log a correlation ID without exposing internal error details.

### GAP-013 — History is capped without a completeness contract

**Priority:** P1 — reporting correctness  
**Evidence:** `src/routes/_authenticated/compare.tsx:31-36` reads only the last 50 calculations. `src/routes/_authenticated/dashboard.tsx:138-149` reads only the last 60. The UI does not clearly tell users that older scenarios are omitted or provide pagination.

**Impact:** Long-lived workspaces can see incomplete comparison and dashboard history, producing misleading pipeline and trend conclusions.

**Recommendation:** Add cursor pagination or server-side aggregation, show the active range and total count, and provide an explicit “load older” path. Add tests with more than the current cap.

### GAP-014 — Shared form labels are not programmatically associated

**Priority:** P1 — accessibility  
**Evidence:** `src/components/ui/field.tsx:10-15` renders a `Label` without `htmlFor`, while the control is a sibling rather than a child of the label. The component is used across settings and people-management forms.

**Impact:** Screen readers and label-click behavior may not identify the correct input. This affects keyboard, assistive-technology, and automated accessibility users across multiple screens.

**Recommendation:** Generate/stabilize an input ID, pass it to `htmlFor`, and ensure error/help text is linked with `aria-describedby`. Add automated axe checks and keyboard smoke tests.

### GAP-015 — Automated regression coverage is insufficient

**Priority:** P1 — release confidence  
**Evidence:** `package.json` defines build, lint, database scripts, and pricing verification scripts, but no test script. No Vitest, Playwright, React Testing Library, or CI workflow was found in the repository file inventory.

**Impact:** Critical workflows—login/recovery, RLS by role, blueprint persistence, save/version concurrency, import rollback, invitations, and production deployment—can regress without a release gate.

**Recommendation:** Add unit tests for pricing/validation, integration tests for Supabase policies and RPCs, and Playwright tests for authentication, blueprint round trip, save/compare, and role restrictions. Run typecheck, lint, tests, migration checks, and a production smoke test in CI.

### GAP-016 — Legacy API reads are not role-scoped

**Priority:** P2 — conditional confidentiality  
**Evidence:** `src/server/api.ts:111-115` applies company scoping, but the generic query path at lines 542-670 allows authenticated members to select broadly. Write authorization has role checks; read authorization does not mirror the role rules.

**Impact:** In MySQL compatibility mode, any authenticated company member may be able to read employee salary fields, overheads, policies, calculations, or audit data depending on the table query. This does not describe active Supabase mode, where RLS is the control plane.

**Recommendation:** Apply per-table/per-column read policies server-side, return safe DTOs instead of `*`, and add cross-role API tests. Disable this mode in production unless it has parity with Supabase authorization.

### GAP-017 — Legacy API generic writes lack domain validation

**Priority:** P2 — conditional data integrity  
**Evidence:** `src/server/api.ts:673-719` and `727-792` accept arbitrary allowed-column keys and values with limited schema checks.

**Impact:** Authorized clients can write malformed salaries, percentages, JSON, or status values that the calculator later interprets unpredictably.

**Recommendation:** Replace generic writes with typed endpoints/DTOs, validate every field against the same domain schema used by the database, and reject unknown or out-of-range values.

### GAP-018 — Search/filter/compare state is not shareable or restorable

**Priority:** P2 — UX  
**Evidence:** Preset search/filter state is held locally in `src/components/calculator/qce/PresetSelector.tsx:21-36` and `src/components/calculator/ProjectBlueprintManager.tsx:80-90,191-221`. Compare selection is also local in `src/routes/_authenticated/compare.tsx:27`.

**Impact:** Refreshing, navigating back, or sharing a URL loses the user’s current view. This makes review and collaboration harder.

**Recommendation:** Encode meaningful filters, selected versions, and pagination in validated route search parameters; preserve only non-sensitive state.

### GAP-019 — Async error communication is inconsistent

**Priority:** P2 — UX/accessibility  
**Evidence:** Several flows rely on toast errors and return/fallback behavior, including preset loading at `src/components/calculator/qce/presetLibrary.tsx:91-95` and calculator save errors at `src/routes/_authenticated/calculator.tsx:695-698,727-729`. The project detail route suppresses errors entirely.

**Impact:** Users may miss transient feedback, assistive technology may not announce it consistently, and failed data loads can look like empty data.

**Recommendation:** Add persistent inline errors for the affected region, `aria-live` status where appropriate, focus the first invalid field, and offer retry without losing entered values.

### GAP-020 — Authenticated route protection is client-side only

**Priority:** P2 — architecture/security boundary  
**Evidence:** `src/routes/_authenticated/route.tsx:6-9` disables SSR and relies on the browser auth guard. An unauthenticated request can receive the application shell for a protected path before the client redirects.

**Impact:** This is not by itself a data leak when backend APIs and RLS are correct, but it exposes private route structure and makes the client gate look stronger than it is. Any future server-rendered data or metadata could accidentally bypass the intended boundary.

**Recommendation:** Keep all data authorization server-side, add server-side route handling where feasible, and test unauthenticated direct requests to every protected path and API.

### GAP-021 — Repository history and distribution hygiene need closure

**Priority:** P2 — operational security  
**Evidence:** The existing `security_best_practices_report.md` records that prior credentials/personnel fixtures remain in Git history and recommends rotation/history cleanup. `README.md:282-284` confirms no license file is included.

**Impact:** Historical secrets or personal data remain recoverable to anyone with repository history, even if current files are clean. Lack of a license makes redistribution and contribution terms unclear.

**Recommendation:** Verify every historical secret is revoked, run a history scanner, remove sensitive objects only under an approved repository-history procedure, and add the organization-approved license. Do not treat deletion from the working tree as secret revocation.

### GAP-022 — Low-impact web hardening gaps remain

**Priority:** P2 — hardening  
**Evidence:** `public/robots.txt` allows all crawlers. It is not a security boundary, but it is unsuitable for an internal authenticated application. The CSP in `src/server.ts:23` also permits `style-src 'unsafe-inline'` and all HTTPS image sources.

**Impact:** Search engines may crawl private-app routes or index shell content, and broad CSP allowances reduce defense-in-depth. The current response headers otherwise include useful protections such as frame denial, content-type protection, referrer policy, and permissions policy.

**Recommendation:** Disallow indexing for private application paths and add `noindex` where appropriate. Narrow CSP sources after confirming framework requirements; retain nonce/hash-based script controls.

### GAP-023 — Initial client bundle is large

**Priority:** P2 — performance  
**Evidence:** The successful production build reports a client chunk above the bundler’s 500 kB warning threshold; the main bundle is approximately 561 kB minified (approximately 160 kB gzip in the audited build).

**Impact:** Slower first load, especially on mobile or high-latency connections. The calculator is an authenticated workflow, so this affects time-to-interactive for users entering estimates.

**Recommendation:** Split route-level and heavy feature-library code, defer non-active wizard steps, and measure Web Vitals on the deployed alias before and after changes.

## Verification results

| Check | Result | Interpretation |
|---|---|---|
| `npm audit --omit=dev --audit-level=moderate` | Pass; 0 reported vulnerabilities | Dependency audit is clean for production dependencies at audit time; it does not replace application review. |
| `npx tsc --noEmit` | Pass | TypeScript has no reported type errors. |
| `npm run build` | Pass | Production client and SSR output build successfully; large-chunk warning remains. |
| `npx eslint . -f json` | Fail; 1,281 errors and 13 warnings across 52 files | Existing lint debt prevents using lint as a release gate. |
| Automated application test command | Not configured | No repeatable auth/RLS/browser regression gate was found. |
| Production HTTP security headers | Present | CSP, HSTS, frame, content-type, referrer, and permissions headers were observed; CSP origin hardcoding remains a deployment gap. |
| Live UI review | Completed for dashboard, calculator, and Blueprint Manager | Screens were visually inspected in the current Chrome audit run. No test data or destructive action was created. |

## Runtime and data-scope notes

- The deployed application was reachable at the production alias and the admin-authenticated dashboard, calculator, and Blueprint Manager screens rendered.
- The Blueprint Manager showed the built-in library. The linked company currently had no stored custom `project_presets` rows during the read-only check, so a custom-preset round trip was not executed and no test record was created.
- The audit did not attempt destructive actions, password changes, invitation sends, data imports, or repository-history rewriting.
- Cross-role authenticated testing and anonymous penetration testing remain required before treating the RLS and login findings as fully closed.
- Current security headers are useful defense-in-depth, but headers do not replace server-side authorization, input validation, or database constraints.

## Recommended remediation order

1. Correct the company-scoped preset load and add a regression test for manager-to-calculator visibility.
2. Resolve the intended financial-data role matrix, then enforce it in Supabase RLS and the legacy API; test every role against sensitive tables.
3. Put save/version/audit behavior behind an atomic database operation with a unique version constraint.
4. Decide whether MySQL compatibility mode is production-supported. If yes, bring it to auth, rate-limit, validation, and authorization parity; otherwise remove it from production exposure.
5. Replace hardcoded deployment/runtime assumptions: Supabase CSP origin, FX source, work calendar, utilization, and salary-policy snapshots.
6. Add missing error states, accessible labels, announced async errors, and history pagination.
7. Establish CI gates for typecheck, lint (after a cleanup baseline), unit/integration tests, RLS tests, migration checks, and production smoke tests.
8. Close operational items: historical secret/PII review and revocation, license decision, robots policy, and bundle-performance measurement.

## Evidence limits

This is a repository-grounded and live-surface gap audit, not a formal penetration test or a compliance certification. The current run used source inspection, migration/policy review, static checks, response-header checks, and visual inspection of key production screens. No broad authenticated role matrix, email-provider delivery test, database-failure injection, concurrent-save test, or external security scan was run. Those should be part of the remediation verification plan.
