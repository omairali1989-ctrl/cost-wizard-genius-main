import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import * as z from "zod/v3";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeProjectStatus, summarizeProjectRevenue } from "@/lib/project-status";
import { getAuthUser } from "./api";

const ACCESS_TTL_SECONDS = 60 * 60;
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_SCOPE = "mcp:read mcp:write";
const VALID_ROLES = [
  "admin",
  "manager",
  "finance",
  "management",
  "project_manager",
  "technical_lead",
  "calculator_user",
  "viewer",
] as const;

type Db = typeof supabaseAdmin;
type FormBody = Record<string, string> & {
  client_id?: string;
  client_name?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_verifier?: string;
  state?: string;
  scope?: string;
  resource?: string;
  grant_type?: string;
  code?: string;
  refresh_token?: string;
};

interface McpContext {
  userId: string;
  companyId: string;
  companyName: string;
  currency: string;
  origin: string;
  roles: string[];
}

interface OAuthClient {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
}

interface EmployeeCostRow {
  id: string;
  name: string;
  job_title: string | null;
  department: string | null;
  seniority: string | null;
  skills: string[] | null;
  active: boolean;
  annual_salary: number;
  employer_cost_pct: number;
  billable_target_pct: number | null;
}

interface MemberRow {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

interface BusinessIntelligenceCalculation {
  id: string;
  project_id: string | null;
  label: string;
  version: number;
  created_at: string;
  results: Record<string, unknown> | null;
  projects: { name?: string; client_name?: string; status?: string } | null;
}

const db = supabaseAdmin as unknown as Db;

function appOrigin(request: Request): string {
  const configured = process.env["APP_URL"] || process.env["VITE_APP_URL"];
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Fall through to the request origin for preview deployments.
    }
  }
  return new URL(request.url).origin;
}

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "application/json; charset=utf-8");
  responseHeaders.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function base64Url(value: Buffer): string {
  return value.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function randomToken(): string {
  return base64Url(randomBytes(32));
}

function safeScopes(scope: string | null | undefined): string {
  const scopes = (scope ?? DEFAULT_SCOPE).split(/\s+/).filter(Boolean);
  const allowed = scopes.filter((item) => item === "mcp:read" || item === "mcp:write");
  return (allowed.length ? allowed : ["mcp:read"]).join(" ");
}

function hasRole(context: McpContext, roles: string[]): boolean {
  return context.roles.some((role) => roles.includes(role));
}

function toolResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

function requireRole(context: McpContext, roles: string[], message: string): void {
  if (!hasRole(context, roles)) throw new Error(message);
}

function metric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMetric(value: number, precision = 2): number {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function recentMonthKeys(count: number): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const offset = count - index - 1;
    return monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1)));
  });
}

async function loadContext(userId: string, origin: string): Promise<McpContext | null> {
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    db.from("profiles").select("id, company_id").eq("id", userId).maybeSingle(),
    db.from("user_roles").select("role, company_id").eq("user_id", userId),
  ]);
  if (!profile?.company_id) return null;
  const roles = (roleRows ?? [])
    .filter((row: { company_id?: string }) => row.company_id === profile.company_id)
    .map((row: { role: string }) => row.role);
  if (!roles.length) return null;
  const { data: company } = await db
    .from("companies")
    .select("id, name, currency")
    .eq("id", profile.company_id)
    .maybeSingle();
  if (!company) return null;
  return {
    userId,
    companyId: profile.company_id,
    companyName: company.name,
    currency: company.currency,
    origin,
    roles,
  };
}

async function getClient(clientId: string): Promise<OAuthClient | null> {
  const { data } = await db
    .from("mcp_oauth_clients")
    .select("client_id, client_name, redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();
  return (data as OAuthClient | null) ?? null;
}

function validRedirect(client: OAuthClient, redirectUri: string): boolean {
  return client.redirect_uris.includes(redirectUri);
}

function redirectWithError(
  redirectUri: string,
  error: string,
  description: string,
  state?: string,
): Response {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description);
  if (state) url.searchParams.set("state", state);
  return Response.redirect(url, 302);
}

async function parseJson(request: Request): Promise<FormBody> {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const value = contentType.includes("application/x-www-form-urlencoded")
      ? Object.fromEntries(new URLSearchParams(await request.text()).entries())
      : ((await request.json()) as Record<string, unknown>);
    return Object.fromEntries(
      Object.entries(value ?? {}).map(([key, item]) => [key, typeof item === "string" ? item : ""]),
    ) as FormBody;
  } catch {
    return {};
  }
}

async function handleRegistration(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let rawBody: Record<string, unknown> = {};
  try {
    rawBody = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_client_metadata" }, 400);
  }
  const body = Object.fromEntries(
    Object.entries(rawBody).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
  ) as FormBody;
  const clientName = body.client_name?.trim();
  const redirectUris = Array.isArray(rawBody["redirect_uris"]) ? rawBody["redirect_uris"] : [];
  const normalizedUris = redirectUris.filter((uri): uri is string => typeof uri === "string");
  if (
    !clientName ||
    clientName.length > 120 ||
    normalizedUris.length < 1 ||
    normalizedUris.length > 10
  ) {
    return json({ error: "invalid_client_metadata" }, 400);
  }
  for (const redirectUri of normalizedUris) {
    let parsed: URL;
    try {
      parsed = new URL(redirectUri);
    } catch {
      return json({ error: "invalid_redirect_uri" }, 400);
    }
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
      return json({ error: "invalid_redirect_uri" }, 400);
    }
  }
  const clientId = `cc_${base64Url(randomBytes(18))}`;
  const { error } = await db.from("mcp_oauth_clients").insert({
    client_id: clientId,
    client_name: clientName,
    redirect_uris: normalizedUris,
  });
  if (error) return json({ error: "server_error" }, 500);
  return json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: clientName,
      redirect_uris: normalizedUris,
      client_secret_expires_at: 0,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: DEFAULT_SCOPE,
    },
    201,
  );
}

async function handleAuthorize(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id") ?? "";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const state = url.searchParams.get("state") ?? undefined;
  const codeChallenge = url.searchParams.get("code_challenge") ?? "";
  const method = url.searchParams.get("code_challenge_method");
  const responseType = url.searchParams.get("response_type");
  const client = await getClient(clientId);
  if (!client || !validRedirect(client, redirectUri)) {
    return json(
      { error: "invalid_request", error_description: "Unknown client or redirect URI." },
      400,
    );
  }
  if (responseType !== "code" || method !== "S256" || codeChallenge.length < 43) {
    return redirectWithError(
      redirectUri,
      "invalid_request",
      "PKCE S256 authorization is required.",
      state,
    );
  }
  const consentUrl = new URL("/mcp-authorize", appOrigin(request));
  for (const key of [
    "client_id",
    "redirect_uri",
    "state",
    "code_challenge",
    "code_challenge_method",
    "resource",
    "scope",
  ]) {
    const value = url.searchParams.get(key);
    if (value) consentUrl.searchParams.set(key, value);
  }
  consentUrl.searchParams.set("client_name", client.client_name);
  return Response.redirect(consentUrl, 302);
}

async function handleAuthorizeComplete(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authorization = request.headers.get("authorization") ?? "";
  const supabaseToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  let userId: string | null = null;
  if (supabaseToken) {
    const { data: userData } = await supabaseAdmin.auth.getUser(supabaseToken);
    userId = userData.user?.id ?? null;
  }
  if (!userId) userId = (await getAuthUser(request))?.id ?? null;
  if (!userId) return json({ error: "unauthorized" }, 401);
  const body = await parseJson(request);
  const clientId = body.client_id ?? "";
  const redirectUri = body.redirect_uri ?? "";
  const codeChallenge = body.code_challenge ?? "";
  const client = await getClient(clientId);
  if (!client || !validRedirect(client, redirectUri) || !codeChallenge) {
    return json({ error: "invalid_request" }, 400);
  }
  const code = randomToken();
  const { error } = await db.from("mcp_oauth_codes").insert({
    code_hash: hashToken(code),
    client_id: clientId,
    user_id: userId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    scope: safeScopes(body.scope),
    resource: body.resource || null,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });
  if (error) return json({ error: "server_error" }, 500);
  const callback = new URL(redirectUri);
  callback.searchParams.set("code", code);
  if (body.state) callback.searchParams.set("state", body.state);
  return json({ redirect_url: callback.toString() });
}

async function handleToken(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const body = await parseJson(request);
  const grantType = body.grant_type;
  if (grantType === "authorization_code") {
    const client = await getClient(body.client_id ?? "");
    if (
      !client ||
      !body.code ||
      !body.code_verifier ||
      !validRedirect(client, body.redirect_uri ?? "")
    ) {
      return json({ error: "invalid_grant" }, 400);
    }
    const { data: codeRow } = await db
      .from("mcp_oauth_codes")
      .select("*")
      .eq("code_hash", hashToken(body.code))
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (
      !codeRow ||
      codeRow.client_id !== client.client_id ||
      codeRow.redirect_uri !== body.redirect_uri
    ) {
      return json({ error: "invalid_grant" }, 400);
    }
    const verifierHash = base64Url(createHash("sha256").update(body.code_verifier).digest());
    if (!constantTimeEqual(verifierHash, codeRow.code_challenge))
      return json({ error: "invalid_grant" }, 400);
    const { data: consumed } = await db
      .from("mcp_oauth_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("code_hash", codeRow.code_hash)
      .is("consumed_at", null)
      .select("code_hash")
      .maybeSingle();
    if (!consumed) return json({ error: "invalid_grant" }, 400);
    return issueTokens(client.client_id, codeRow.user_id, codeRow.scope, codeRow.resource);
  }
  if (grantType === "refresh_token") {
    if (!body.refresh_token) return json({ error: "invalid_grant" }, 400);
    const { data: tokenRow } = await db
      .from("mcp_oauth_tokens")
      .select("*")
      .eq("refresh_token_hash", hashToken(body.refresh_token))
      .is("revoked_at", null)
      .gt("refresh_expires_at", new Date().toISOString())
      .maybeSingle();
    if (!tokenRow || tokenRow.client_id !== body.client_id)
      return json({ error: "invalid_grant" }, 400);
    return issueTokens(
      tokenRow.client_id,
      tokenRow.user_id,
      safeScopes(body.scope || tokenRow.scope),
      tokenRow.resource,
      tokenRow.token_hash,
    );
  }
  return json({ error: "unsupported_grant_type" }, 400);
}

async function issueTokens(
  clientId: string,
  userId: string,
  scope: string,
  resource: string | null,
  revokeTokenHash?: string,
): Promise<Response> {
  const accessToken = randomToken();
  const refreshToken = randomToken();
  if (revokeTokenHash) {
    await db
      .from("mcp_oauth_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", revokeTokenHash);
  }
  const { error } = await db.from("mcp_oauth_tokens").insert({
    token_hash: hashToken(accessToken),
    refresh_token_hash: hashToken(refreshToken),
    client_id: clientId,
    user_id: userId,
    scope,
    resource,
    expires_at: new Date(Date.now() + ACCESS_TTL_SECONDS * 1000).toISOString(),
    refresh_expires_at: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000).toISOString(),
  });
  if (error) return json({ error: "server_error" }, 500);
  return json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TTL_SECONDS,
    refresh_token: refreshToken,
    scope,
  });
}

function bearerToken(request: Request): string | null {
  return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

async function verifyMcpToken(
  token: string,
  origin: string,
): Promise<{
  context: McpContext;
  clientId: string;
  scope: string;
  resource: string | null;
} | null> {
  const { data } = await db
    .from("mcp_oauth_tokens")
    .select("token_hash, client_id, user_id, scope, resource, expires_at")
    .eq("token_hash", hashToken(token))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  const context = await loadContext(data.user_id, origin);
  if (!context) return null;
  return { context, clientId: data.client_id, scope: data.scope, resource: data.resource };
}

function unauthorized(request: Request): Response {
  const metadata = `${appOrigin(request)}/.well-known/oauth-protected-resource`;
  return json(
    { error: "unauthorized", error_description: "A CostCraft MCP access token is required." },
    401,
    { "www-authenticate": `Bearer resource_metadata="${metadata}"` },
  );
}

function registerTools(server: McpServer, context: McpContext): void {
  server.registerTool(
    "get_workspace_summary",
    {
      title: "Get workspace summary",
      description:
        "Read the current company, pricing policy, project count, and team summary. Never returns salaries or passwords.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const [
        { data: policy },
        { count: projectCount },
        { count: employeeCount },
        { count: calculationCount },
        { data: overheads },
      ] = await Promise.all([
        db
          .from("cost_policies")
          .select(
            "working_days_per_year, hours_per_day, default_utilization_pct, default_contingency_pct, default_margin_pct, default_markup_pct, pricing_mode, rounding_step",
          )
          .eq("company_id", context.companyId)
          .maybeSingle(),
        db
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("company_id", context.companyId),
        db
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("company_id", context.companyId)
          .eq("active", true),
        db
          .from("calculations")
          .select("id", { count: "exact", head: true })
          .eq("company_id", context.companyId),
        db.from("overheads").select("monthly_amount").eq("company_id", context.companyId),
      ]);
      const monthlyOverhead = (overheads ?? []).reduce(
        (sum: number, row: { monthly_amount?: number }) => sum + Number(row.monthly_amount ?? 0),
        0,
      );
      return toolResult({
        company: context.companyName,
        currency: context.currency,
        roles: context.roles,
        active_team_members: employeeCount ?? 0,
        projects: projectCount ?? 0,
        saved_calculations: calculationCount ?? 0,
        monthly_overhead: monthlyOverhead,
        policy,
      });
    },
  );

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "List projects in the signed-in user's CostCraft workspace.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const { data, error } = await db
        .from("projects")
        .select("id, name, client_name, description, status, created_at, updated_at")
        .eq("company_id", context.companyId)
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return toolResult({ projects: data ?? [] });
    },
  );

  server.registerTool(
    "get_business_intelligence",
    {
      title: "Get business intelligence",
      description:
        "Analyze the latest saved estimate for every project and return executive KPIs, monthly pipeline movement, commercial risk, concentration, top projects, and prioritized actions. Uses aggregate project costs only and never returns employee salaries.",
      inputSchema: {
        lookback_months: z.number().int().min(3).max(24).default(6),
        project_limit: z.number().int().min(1).max(25).default(10),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ lookback_months, project_limit }) => {
      const [{ data: calculations, error }, { data: policy }] = await Promise.all([
        db
          .from("calculations")
          .select(
            "id, project_id, label, version, results, created_at, projects(name, client_name, status)",
          )
          .eq("company_id", context.companyId)
          .order("created_at", { ascending: false })
          .limit(1000),
        db
          .from("cost_policies")
          .select("default_margin_pct")
          .eq("company_id", context.companyId)
          .maybeSingle(),
      ]);
      if (error) throw new Error(error.message);

      const latestByProject = new Map<string, BusinessIntelligenceCalculation>();
      for (const calculation of (calculations ?? []) as BusinessIntelligenceCalculation[]) {
        const key = calculation.project_id ?? calculation.id;
        const current = latestByProject.get(key);
        if (!current || calculation.version > current.version) {
          latestByProject.set(key, calculation);
        }
      }
      const latest = [...latestByProject.values()];
      const targetMarginPct = metric(policy?.default_margin_pct) || 25;

      const projects = latest.map((calculation) => {
        const result = calculation.results ?? {};
        const price = metric(result["price"]);
        const totalCost = metric(result["totalCost"]);
        const profit = metric(result["profit"]);
        const netProfit = metric(result["netProfitAfterCommission"] ?? result["profit"]);
        const marginPct = metric(result["marginPct"]);
        return {
          project_id: calculation.project_id,
          project_name: calculation.projects?.name ?? "Untitled",
          client_name: calculation.projects?.client_name ?? null,
          status: normalizeProjectStatus(calculation.projects?.status),
          estimate_label: calculation.label,
          version: calculation.version,
          estimated_at: calculation.created_at,
          price,
          total_cost: totalCost,
          profit,
          net_profit_after_commission: netProfit,
          margin_pct: marginPct,
          hours: metric(result["totalHours"]),
          pricing_infeasible: result["pricingInfeasible"] === true,
        };
      });

      const pipelineValue = projects.reduce((sum, project) => sum + project.price, 0);
      const revenue = summarizeProjectRevenue(projects);
      const totalCost = projects.reduce((sum, project) => sum + project.total_cost, 0);
      const grossProfit = projects.reduce((sum, project) => sum + project.profit, 0);
      const netProfit = projects.reduce(
        (sum, project) => sum + project.net_profit_after_commission,
        0,
      );
      const totalHours = projects.reduce((sum, project) => sum + project.hours, 0);
      const weightedMarginPct = pipelineValue > 0 ? (grossProfit / pipelineValue) * 100 : 0;
      const averageProjectValue = projects.length ? pipelineValue / projects.length : 0;
      const belowTarget = projects.filter((project) => project.margin_pct < targetMarginPct);
      const negativeProfit = projects.filter((project) => project.net_profit_after_commission < 0);
      const infeasible = projects.filter((project) => project.pricing_infeasible);

      const sortedProjects = [...projects].sort((a, b) => b.price - a.price);
      const largestProjectSharePct =
        pipelineValue > 0 ? (metric(sortedProjects[0]?.price) / pipelineValue) * 100 : 0;
      const topThreeSharePct =
        pipelineValue > 0
          ? (sortedProjects.slice(0, 3).reduce((sum, project) => sum + project.price, 0) /
              pipelineValue) *
            100
          : 0;

      const months = recentMonthKeys(lookback_months);
      const monthlyTrend = months.map((month) => {
        const monthProjects = projects.filter(
          (project) => project.estimated_at.slice(0, 7) === month,
        );
        const value = monthProjects.reduce((sum, project) => sum + project.price, 0);
        const monthProfit = monthProjects.reduce((sum, project) => sum + project.profit, 0);
        const monthRevenue = summarizeProjectRevenue(monthProjects);
        return {
          month,
          projects_quoted: monthProjects.length,
          pipeline_value: roundMetric(value),
          sent_pipeline_value: roundMetric(monthRevenue.sentPipeline),
          booked_revenue: roundMetric(monthRevenue.bookedRevenue),
          completed_revenue: roundMetric(monthRevenue.completedRevenue),
          gross_profit: roundMetric(monthProfit),
          weighted_margin_pct: roundMetric(value > 0 ? (monthProfit / value) * 100 : 0, 1),
        };
      });

      const currentMonth = monthlyTrend.at(-1) ?? null;
      const previousMonth = monthlyTrend.at(-2) ?? null;
      const monthOverMonthPipelinePct =
        previousMonth && previousMonth.pipeline_value > 0 && currentMonth
          ? ((currentMonth.pipeline_value - previousMonth.pipeline_value) /
              previousMonth.pipeline_value) *
            100
          : null;

      const actions: Array<{ priority: "high" | "medium" | "low"; action: string }> = [];
      if (!projects.length) {
        actions.push({
          priority: "high",
          action: "Save at least one project estimate to establish a commercial baseline.",
        });
      }
      if (projects.length && revenue.bookedRevenue === 0 && revenue.sentPipeline === 0) {
        actions.push({
          priority: "medium",
          action:
            "Set project statuses to Sent, Approved, In progress, or Completed to activate revenue reporting.",
        });
      }
      if (negativeProfit.length) {
        actions.push({
          priority: "high",
          action: `Reprice ${negativeProfit.length} project${negativeProfit.length === 1 ? "" : "s"} with negative net profit.`,
        });
      }
      if (infeasible.length) {
        actions.push({
          priority: "high",
          action: `Review margin and commission assumptions for ${infeasible.length} pricing-infeasible project${infeasible.length === 1 ? "" : "s"}.`,
        });
      }
      if (belowTarget.length) {
        actions.push({
          priority: "medium",
          action: `Review ${belowTarget.length} project${belowTarget.length === 1 ? "" : "s"} below the ${roundMetric(targetMarginPct, 1)}% margin target.`,
        });
      }
      if (largestProjectSharePct >= 50) {
        actions.push({
          priority: "medium",
          action: `Reduce concentration risk: the largest estimate represents ${roundMetric(largestProjectSharePct, 1)}% of pipeline value.`,
        });
      }
      if (monthOverMonthPipelinePct !== null && monthOverMonthPipelinePct <= -20) {
        actions.push({
          priority: "medium",
          action: `Investigate pipeline velocity; current-month estimate value is down ${roundMetric(Math.abs(monthOverMonthPipelinePct), 1)}% month over month.`,
        });
      }
      if (projects.length && !actions.length) {
        actions.push({
          priority: "low",
          action:
            "No material pricing exceptions detected; continue monitoring margin and concentration.",
        });
      }

      return toolResult({
        generated_at: new Date().toISOString(),
        company: context.companyName,
        currency: context.currency,
        scope: "Latest saved estimate per project",
        executive_summary: {
          projects_quoted: projects.length,
          pipeline_value: roundMetric(pipelineValue),
          sent_pipeline_value: roundMetric(revenue.sentPipeline),
          booked_revenue: roundMetric(revenue.bookedRevenue),
          approved_revenue: roundMetric(revenue.approvedRevenue),
          in_progress_revenue: roundMetric(revenue.inProgressRevenue),
          completed_revenue: roundMetric(revenue.completedRevenue),
          project_status_counts: revenue.counts,
          total_estimated_cost: roundMetric(totalCost),
          gross_profit: roundMetric(grossProfit),
          net_profit_after_commission: roundMetric(netProfit),
          weighted_margin_pct: roundMetric(weightedMarginPct, 1),
          target_margin_pct: roundMetric(targetMarginPct, 1),
          average_project_value: roundMetric(averageProjectValue),
          total_scoped_hours: roundMetric(totalHours, 1),
          month_over_month_pipeline_pct:
            monthOverMonthPipelinePct === null ? null : roundMetric(monthOverMonthPipelinePct, 1),
        },
        risk: {
          projects_below_margin_target: belowTarget.length,
          projects_with_negative_net_profit: negativeProfit.length,
          pricing_infeasible_projects: infeasible.length,
          largest_project_share_pct: roundMetric(largestProjectSharePct, 1),
          top_three_share_pct: roundMetric(topThreeSharePct, 1),
        },
        monthly_trend: monthlyTrend,
        top_projects: sortedProjects.slice(0, project_limit).map((project) => ({
          ...project,
          price: roundMetric(project.price),
          total_cost: roundMetric(project.total_cost),
          profit: roundMetric(project.profit),
          net_profit_after_commission: roundMetric(project.net_profit_after_commission),
          margin_pct: roundMetric(project.margin_pct, 1),
          hours: roundMetric(project.hours, 1),
          pipeline_share_pct: roundMetric(
            pipelineValue > 0 ? (project.price / pipelineValue) * 100 : 0,
            1,
          ),
        })),
        recommended_actions: actions,
      });
    },
  );

  server.registerTool(
    "get_project_cost",
    {
      title: "Get project cost",
      description:
        "Read the latest saved estimate for one project. Returns calculation totals only, not employee salaries.",
      inputSchema: { project_id: z.string().uuid() },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ project_id }) => {
      const [{ data: project }, { data: calculation, error }] = await Promise.all([
        db
          .from("projects")
          .select("id, name, client_name, status, created_at, updated_at")
          .eq("id", project_id)
          .eq("company_id", context.companyId)
          .maybeSingle(),
        db
          .from("calculations")
          .select("id, label, version, results, created_at")
          .eq("project_id", project_id)
          .eq("company_id", context.companyId)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (error) throw new Error(error.message);
      if (!project) throw new Error("Project not found in this workspace.");
      return toolResult({
        project,
        latest_calculation: calculation ? { ...calculation, results: calculation.results } : null,
      });
    },
  );

  server.registerTool(
    "list_team_costs",
    {
      title: "List team cost rates",
      description:
        "Read salary-free hourly cost rates. Finance visibility is required; annual salaries are never returned.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      requireRole(
        context,
        ["admin", "finance", "management"],
        "Finance visibility is required to view team cost rates.",
      );
      const [{ data: policy }, { data: employees }, { data: overheads }] = await Promise.all([
        db
          .from("cost_policies")
          .select("working_days_per_year, hours_per_day, default_utilization_pct")
          .eq("company_id", context.companyId)
          .maybeSingle(),
        db
          .from("employees")
          .select(
            "id, name, job_title, department, seniority, skills, active, annual_salary, employer_cost_pct, billable_target_pct",
          )
          .eq("company_id", context.companyId)
          .order("name"),
        db.from("overheads").select("monthly_amount").eq("company_id", context.companyId),
      ]);
      const activeCount = Math.max(
        (employees ?? []).filter((employee: { active?: boolean }) => employee.active).length,
        1,
      );
      const annualOverheadPerPerson =
        (overheads ?? []).reduce(
          (sum: number, row: { monthly_amount?: number }) =>
            sum + Number(row.monthly_amount ?? 0) * 12,
          0,
        ) / activeCount;
      const days = Number(policy?.working_days_per_year ?? 220);
      const hours = Number(policy?.hours_per_day ?? 8);
      const defaultUtilization = Number(policy?.default_utilization_pct ?? 75);
      const rates = (employees ?? []).map((employee: EmployeeCostRow) => {
        const utilization = Number(employee.billable_target_pct || defaultUtilization);
        const denominator = days * hours * (utilization / 100);
        const hourlyCost =
          denominator > 0
            ? (Number(employee.annual_salary) *
                (1 + Number(employee.employer_cost_pct ?? 20) / 100) +
                annualOverheadPerPerson) /
              denominator
            : 0;
        return {
          id: employee.id,
          name: employee.name,
          job_title: employee.job_title,
          department: employee.department,
          seniority: employee.seniority,
          skills: employee.skills ?? [],
          active: employee.active,
          hourly_cost: Math.round(hourlyCost * 100) / 100,
        };
      });
      return toolResult({ rates });
    },
  );

  server.registerTool(
    "list_team_members",
    {
      title: "List team members",
      description: "List workspace members and roles. Administrator visibility is required.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      requireRole(
        context,
        ["admin"],
        "Administrator access is required to view member identities and roles.",
      );
      const { data, error } = await db
        .from("profiles")
        .select("id, full_name, email, created_at")
        .eq("company_id", context.companyId)
        .order("created_at");
      if (error) throw new Error(error.message);
      const ids = (data ?? []).map((member: { id: string }) => member.id);
      const { data: roles } = await db
        .from("user_roles")
        .select("user_id, role")
        .eq("company_id", context.companyId)
        .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const members = (data ?? []).map((member: MemberRow) => ({
        ...member,
        roles: (roles ?? [])
          .filter((row: { user_id: string }) => row.user_id === member.id)
          .map((row: { role: string }) => row.role),
      }));
      return toolResult({ members });
    },
  );

  server.registerTool(
    "update_pricing_policy",
    {
      title: "Update pricing policy",
      description:
        "Update CostCraft pricing defaults. Requires Admin or Finance. This changes future calculations and should be confirmed by the user before execution.",
      inputSchema: {
        working_days_per_year: z.number().min(1).max(366).optional(),
        hours_per_day: z.number().min(1).max(24).optional(),
        default_utilization_pct: z.number().min(1).max(100).optional(),
        default_contingency_pct: z.number().min(0).max(100).optional(),
        default_margin_pct: z.number().min(0).max(95).optional(),
        default_markup_pct: z.number().min(0).max(1000).optional(),
        pricing_mode: z.enum(["margin", "markup"]).optional(),
        rounding_step: z.number().min(0).max(1000000).optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      requireRole(
        context,
        ["admin", "finance"],
        "Admin or Finance access is required to update pricing policy.",
      );
      const patch = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      );
      if (!Object.keys(patch).length) throw new Error("Provide at least one pricing policy field.");
      const { error } = await db
        .from("cost_policies")
        .update(patch)
        .eq("company_id", context.companyId);
      if (error) throw new Error(error.message);
      await db.from("audit_log").insert({
        company_id: context.companyId,
        user_id: context.userId,
        action: "updated",
        entity: "cost_policy",
        entity_id: null,
        details: { source: "mcp", fields: Object.keys(patch) },
      });
      return toolResult({
        updated: true,
        fields: Object.keys(patch),
        note: "Future calculations use the updated policy; saved estimates remain snapshots.",
      });
    },
  );

  server.registerTool(
    "change_member_role",
    {
      title: "Change member role",
      description:
        "Change one workspace member's role. Requires Admin. The last administrator is protected.",
      inputSchema: { user_id: z.string().uuid(), role: z.enum(VALID_ROLES) },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ user_id, role }) => {
      requireRole(context, ["admin"], "Administrator access is required to change member roles.");
      const { error } = await db.rpc("mcp_set_member_role", {
        _actor_user_id: context.userId,
        _user_id: user_id,
        _role: role,
      });
      if (error) throw new Error(error.message);
      return toolResult({ updated: true, user_id, role });
    },
  );

  server.registerTool(
    "remove_member",
    {
      title: "Remove member",
      description:
        "Remove a person from the workspace. Requires Admin. This is a destructive action and must be confirmed by the user.",
      inputSchema: { user_id: z.string().uuid() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ user_id }) => {
      requireRole(context, ["admin"], "Administrator access is required to remove members.");
      const { error } = await db.rpc("mcp_remove_member", {
        _actor_user_id: context.userId,
        _user_id: user_id,
      });
      if (error) throw new Error(error.message);
      return toolResult({ removed: true, user_id });
    },
  );

  server.registerTool(
    "invite_collaborator",
    {
      title: "Invite collaborator",
      description:
        "Create a branded CostCraft workspace invitation. Requires Admin. The caller must still deliver the returned link through an approved channel.",
      inputSchema: { email: z.string().email(), role: z.enum(VALID_ROLES).default("viewer") },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ email, role }) => {
      requireRole(context, ["admin"], "Administrator access is required to invite collaborators.");
      const { data, error } = await db.rpc("mcp_create_invitation", {
        _actor_user_id: context.userId,
        _email: email.trim().toLowerCase(),
        _role: role,
      });
      if (error) throw new Error(error.message);
      const invitation = Array.isArray(data) ? data[0] : data;
      if (!invitation?.token) throw new Error("Invitation could not be created.");
      const origin = context.origin;
      return toolResult({
        invited: true,
        email: email.trim().toLowerCase(),
        role,
        invite_url: origin ? `${origin}/invite/${invitation.token}` : null,
        expires_at: invitation.expires_at,
        note: "Use the application email template or another approved company channel to deliver the invitation.",
      });
    },
  );
}

async function handleMcp(request: Request): Promise<Response> {
  const token = bearerToken(request);
  if (!token) return unauthorized(request);
  const verified = await verifyMcpToken(token, new URL(request.url).origin);
  if (!verified) return unauthorized(request);
  const server = new McpServer({ name: "CostCraft", version: "1.0.0" });
  registerTools(server, verified.context);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  } as unknown as ConstructorParameters<typeof WebStandardStreamableHTTPServerTransport>[0]);
  await server.connect(transport);
  const authInfo: import("@modelcontextprotocol/sdk/server/auth/types.js").AuthInfo = {
    token,
    clientId: verified.clientId,
    scopes: verified.scope.split(/\s+/),
    extra: { userId: verified.context.userId, companyId: verified.context.companyId },
  };
  if (verified.resource) authInfo.resource = new URL(verified.resource);
  return transport.handleRequest(request, {
    authInfo,
  });
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (
      url.pathname === "/.well-known/oauth-protected-resource" ||
      url.pathname === "/.well-known/oauth-protected-resource/mcp"
    ) {
      const origin = appOrigin(request);
      return json({
        resource: `${origin}/mcp`,
        authorization_servers: [origin],
        bearer_methods_supported: ["header"],
      });
    }
    if (url.pathname === "/.well-known/oauth-authorization-server") {
      const origin = appOrigin(request);
      return json({
        issuer: origin,
        authorization_endpoint: `${origin}/oauth/authorize`,
        token_endpoint: `${origin}/oauth/token`,
        registration_endpoint: `${origin}/oauth/register`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
        scopes_supported: ["mcp:read", "mcp:write"],
      });
    }
    if (url.pathname === "/oauth/register") return handleRegistration(request);
    if (url.pathname === "/oauth/authorize") return handleAuthorize(request);
    if (url.pathname === "/oauth/authorize/complete") return handleAuthorizeComplete(request);
    if (url.pathname === "/oauth/token") return handleToken(request);
    if (url.pathname === "/mcp") return handleMcp(request);
    return json({ error: "not_found" }, 404);
  } catch (error) {
    console.error("MCP request failed", error);
    return json(
      { error: "server_error", error_description: "The MCP request could not be completed." },
      500,
    );
  }
}
