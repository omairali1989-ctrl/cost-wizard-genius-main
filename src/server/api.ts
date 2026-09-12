import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { pool, query, queryOne } from "../lib/mysql";
import { convertCurrency } from "../lib/currency";

const ALLOWED_TABLES = new Set([
  "companies",
  "profiles",
  "user_roles",
  "cost_policies",
  "employees",
  "overheads",
  "projects",
  "calculations",
  "audit_log",
  "invitations",
  "scope_features",
]);

const JSON_COLUMNS = new Set(["skills", "inputs", "results", "details", "raw_user_meta_data", "effort", "tags"]);

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function parseJsonRow(row: any) {
  if (!row) return row;
  const copy = { ...row };
  for (const key of Object.keys(copy)) {
    if (JSON_COLUMNS.has(key) && typeof copy[key] === "string") {
      try {
        copy[key] = JSON.parse(copy[key]);
      } catch {
        // keep as is
      }
    }
  }
  return copy;
}

async function getAuthUser(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const session = await queryOne<{ user_id: string; expires_at: Date }>(
    "SELECT user_id, expires_at FROM sessions WHERE token = ? AND expires_at > NOW()",
    [token]
  );
  if (!session) return null;

  const user = await queryOne<{ id: string; email: string; raw_user_meta_data: any }>(
    "SELECT id, email, raw_user_meta_data FROM auth_users WHERE id = ?",
    [session.user_id]
  );
  if (!user) return null;

  let meta = user.raw_user_meta_data;
  if (typeof meta === "string") {
    try {
      meta = JSON.parse(meta);
    } catch {
      meta = {};
    }
  }

  return {
    id: user.id,
    email: user.email,
    user_metadata: meta || {},
  };
}

export async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
        "Access-Control-Max-Age": "600",
      },
    });
  }

  if (process.env.VITE_BACKEND === "supabase") {
    return jsonResponse(
      { error: { message: "The legacy MySQL API is disabled while Supabase is active." } },
      410,
    );
  }

  try {
    // -------------------------------------------------------------
    // AUTHENTICATION ROUTES
    // -------------------------------------------------------------
    if (path === "/api/auth/login" && request.method === "POST") {
      const body = await request.json();
      const { email, password } = body;

      if (!email || !password) {
        return jsonResponse({ error: { message: "Email and password are required." } }, 400);
      }

      const user = await queryOne<{ id: string; email: string; password_hash: string; raw_user_meta_data: any }>(
        "SELECT id, email, password_hash, raw_user_meta_data FROM auth_users WHERE email = ?",
        [email.trim().toLowerCase()]
      );

      if (!user) {
        return jsonResponse({ error: { message: "Invalid email or password." } }, 400);
      }

      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        return jsonResponse({ error: { message: "Invalid email or password." } }, 400);
      }

      const token = crypto.randomUUID() + "-" + crypto.randomBytes(16).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await query("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", [
        token,
        user.id,
        expiresAt,
      ]);

      let meta = user.raw_user_meta_data;
      if (typeof meta === "string") {
        try {
          meta = JSON.parse(meta);
        } catch {
          meta = {};
        }
      }

      const userObj = {
        id: user.id,
        email: user.email,
        user_metadata: meta || {},
      };

      return jsonResponse({
        data: {
          session: {
            access_token: token,
            token_type: "bearer",
            user: userObj,
          },
          user: userObj,
        },
        error: null,
      });
    }

    if (path === "/api/auth/signup" && request.method === "POST") {
      const body = await request.json();
      const { email, password, options } = body;

      if (!email || !password) {
        return jsonResponse({ error: { message: "Email and password are required." } }, 400);
      }

      const existing = await queryOne("SELECT id FROM auth_users WHERE email = ?", [email.trim().toLowerCase()]);
      if (existing) {
        return jsonResponse({ error: { message: "User already registered." } }, 400);
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = crypto.randomUUID();
      const meta = options?.data || {};

      await query(
        "INSERT INTO auth_users (id, email, password_hash, raw_user_meta_data) VALUES (?, ?, ?, ?)",
        [userId, email.trim().toLowerCase(), passwordHash, JSON.stringify(meta)]
      );

      await query(
        "INSERT INTO profiles (id, full_name, email) VALUES (?, ?, ?)",
        [userId, meta.full_name || null, email.trim().toLowerCase()]
      );

      const token = crypto.randomUUID() + "-" + crypto.randomBytes(16).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await query("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", [
        token,
        userId,
        expiresAt,
      ]);

      const userObj = {
        id: userId,
        email: email.trim().toLowerCase(),
        user_metadata: meta,
      };

      return jsonResponse({
        data: {
          session: {
            access_token: token,
            token_type: "bearer",
            user: userObj,
          },
          user: userObj,
        },
        error: null,
      });
    }

    if (path === "/api/auth/user" && request.method === "GET") {
      const user = await getAuthUser(request);
      if (!user) {
        return jsonResponse({ data: { user: null }, error: { message: "Not authenticated" } }, 401);
      }
      return jsonResponse({ data: { user }, error: null });
    }

    if (path === "/api/auth/logout" && request.method === "POST") {
      const authHeader = request.headers.get("authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (token) {
        await query("DELETE FROM sessions WHERE token = ?", [token]);
      }
      return jsonResponse({ error: null });
    }

    // -------------------------------------------------------------
    // RPC STORED PROCEDURES
    // -------------------------------------------------------------
    if (path.startsWith("/api/rpc/") && request.method === "POST") {
      const rpcName = path.replace("/api/rpc/", "");
      const body = await request.json().catch(() => ({}));
      const currentUser = await getAuthUser(request);

      // Helper to get company_id of current user
      const getUserCompanyId = async () => {
        if (!currentUser) return null;
        const prof = await queryOne<{ company_id: string }>("SELECT company_id FROM profiles WHERE id = ?", [currentUser.id]);
        return prof?.company_id || null;
      };

      // 1. company_employee_rates
      if (rpcName === "company_employee_rates") {
        const companyId = await getUserCompanyId();
        if (!companyId) {
          return jsonResponse({ data: [], error: null });
        }

        const policy = await queryOne<any>("SELECT * FROM cost_policies WHERE company_id = ?", [companyId]);
        const company = await queryOne<any>("SELECT currency FROM companies WHERE id = ?", [companyId]);
        const overheadRows = await query<any>("SELECT monthly_amount, period FROM overheads WHERE company_id = ?", [companyId]);
        const employees = await query<any>("SELECT * FROM employees WHERE company_id = ? ORDER BY name ASC", [companyId]);

        const totalMonthlyOverheads = overheadRows.reduce(
          (sum, o) => sum + Number(o.monthly_amount || 0) / (o.period === "yearly" ? 12 : 1),
          0,
        );
        const activeCount = Math.max(employees.filter(e => Boolean(e.active)).length, 1);
        const annualPerEmployeeOverhead = (totalMonthlyOverheads * 12) / activeCount;

        const workingDays = Number(policy?.working_days_per_year || 240);
        const hoursPerDay = Number(policy?.hours_per_day || 8);
        const defaultUtil = Number(policy?.default_utilization_pct || 75);

        const results = employees.map((emp) => {
          let skills = emp.skills;
          if (typeof skills === "string") {
            try { skills = JSON.parse(skills); } catch { skills = []; }
          }
          if (!Array.isArray(skills)) skills = [];

          const targetPct = Number(emp.billable_target_pct);
          const utilPct = targetPct > 0 ? targetPct : defaultUtil;
          const billableHours = workingDays * hoursPerDay * (utilPct / 100);

          const monthlySalary = Number(emp.monthly_salary || 0);
          const annualSalary = monthlySalary > 0 ? monthlySalary * 12 : Number(emp.annual_salary || 0);
          const baseSalary = convertCurrency(
            annualSalary,
            emp.salary_currency || company?.currency || "USD",
            company?.currency || "USD",
          );
          const employerPct = Number(emp.employer_cost_pct || 20) / 100;
          const overheadPortion = Boolean(emp.active) ? annualPerEmployeeOverhead : 0;
          const annualBase = (baseSalary * (1 + employerPct)) + overheadPortion;

          const hourlyCost = billableHours > 0 ? Math.round((annualBase / billableHours) * 100) / 100 : 0;

          return {
            id: emp.id,
            name: emp.name,
            job_title: emp.job_title,
            department: emp.department,
            seniority: emp.seniority,
            skills,
            active: Boolean(emp.active),
            hourly_cost: hourlyCost,
          };
        });

        return jsonResponse({ data: results, error: null });
      }

      // 2. company_members
      if (rpcName === "company_members") {
        const companyId = await getUserCompanyId();
        if (!companyId) return jsonResponse({ data: [], error: null });

        const rows = await query<any>(
          `SELECT p.id as user_id, p.full_name, p.email, p.created_at as joined_at, ur.role
           FROM profiles p
           LEFT JOIN user_roles ur ON ur.user_id = p.id AND ur.company_id = p.company_id
           WHERE p.company_id = ?
           ORDER BY p.created_at ASC`,
          [companyId]
        );

        const memberMap = new Map<string, any>();
        for (const r of rows) {
          if (!memberMap.has(r.user_id)) {
            memberMap.set(r.user_id, {
              user_id: r.user_id,
              full_name: r.full_name,
              email: r.email,
              roles: [],
              joined_at: r.joined_at,
            });
          }
          if (r.role && !memberMap.get(r.user_id).roles.includes(r.role)) {
            memberMap.get(r.user_id).roles.push(r.role);
          }
        }

        return jsonResponse({ data: Array.from(memberMap.values()), error: null });
      }

      // 3. create_company
      if (rpcName === "create_company") {
        if (!currentUser) return jsonResponse({ error: { message: "Not authenticated" } }, 401);
        const { _name, _industry, _currency } = body;
        const newId = crypto.randomUUID();

        await query(
          "INSERT INTO companies (id, name, industry, currency) VALUES (?, ?, ?, ?)",
          [newId, _name, _industry || null, _currency || "PKR"]
        );

        await query("UPDATE profiles SET company_id = ? WHERE id = ?", [newId, currentUser.id]);
        await query(
          "INSERT INTO user_roles (id, user_id, company_id, role) VALUES (?, ?, ?, 'admin')",
          [crypto.randomUUID(), currentUser.id, newId]
        );

        await query(
          `INSERT INTO cost_policies 
           (id, company_id, working_days_per_year, hours_per_day, default_utilization_pct, default_contingency_pct, default_margin_pct, pricing_mode, default_markup_pct, rounding_step)
           VALUES (?, ?, 240, 8, 75, 10, 25, 'margin', 35, 100)`,
          [crypto.randomUUID(), newId]
        );

        await query(
          `INSERT INTO overheads (id, company_id, name, category, monthly_amount, allocation_basis) VALUES
           (?, ?, 'Office & facilities', 'facilities', 0, 'per_employee'),
           (?, ?, 'Software & tooling', 'software', 0, 'per_employee'),
           (?, ?, 'Admin & support staff', 'admin', 0, 'per_employee')`,
          [
            crypto.randomUUID(), newId,
            crypto.randomUUID(), newId,
            crypto.randomUUID(), newId,
          ]
        );

        return jsonResponse({ data: newId, error: null });
      }

      // 4. set_member_role
      if (rpcName === "set_member_role") {
        const companyId = await getUserCompanyId();
        const { _user_id, _role } = body;
        if (!companyId) return jsonResponse({ error: { message: "No company" } }, 400);

        await query("DELETE FROM user_roles WHERE user_id = ? AND company_id = ?", [_user_id, companyId]);
        await query("INSERT INTO user_roles (id, user_id, company_id, role) VALUES (?, ?, ?, ?)", [
          crypto.randomUUID(), _user_id, companyId, _role
        ]);
        return jsonResponse({ data: null, error: null });
      }

      // 5. remove_member
      if (rpcName === "remove_member") {
        const companyId = await getUserCompanyId();
        const { _user_id } = body;
        if (!companyId) return jsonResponse({ error: { message: "No company" } }, 400);

        await query("DELETE FROM user_roles WHERE user_id = ? AND company_id = ?", [_user_id, companyId]);
        await query("UPDATE profiles SET company_id = NULL WHERE id = ?", [_user_id]);
        return jsonResponse({ data: null, error: null });
      }

      // 6. invitation_preview
      if (rpcName === "invitation_preview") {
        const { _token } = body;
        const inv = await queryOne<any>(
          `SELECT i.email, i.role, i.status, i.expires_at, c.name as company_name
           FROM invitations i
           JOIN companies c ON c.id = i.company_id
           WHERE i.token = ?`,
          [_token]
        );
        if (!inv) return jsonResponse({ error: { message: "Invitation not found" } }, 404);
        const expired = new Date() > new Date(inv.expires_at);
        return jsonResponse({
          data: [{ email: inv.email, role: inv.role, company_name: inv.company_name, status: inv.status, expired }],
          error: null,
        });
      }

      // 7. accept_invitation
      if (rpcName === "accept_invitation") {
        if (!currentUser) return jsonResponse({ error: { message: "Please sign in first." } }, 401);
        const { _token } = body;
        const inv = await queryOne<any>("SELECT * FROM invitations WHERE token = ?", [_token]);
        if (!inv) return jsonResponse({ error: { message: "Invalid invitation" } }, 400);

        await query("UPDATE profiles SET company_id = ? WHERE id = ?", [inv.company_id, currentUser.id]);
        await query("INSERT INTO user_roles (id, user_id, company_id, role) VALUES (?, ?, ?, ?)", [
          crypto.randomUUID(), currentUser.id, inv.company_id, inv.role
        ]);
        await query("UPDATE invitations SET status = 'accepted', responded_at = NOW() WHERE id = ?", [inv.id]);

        return jsonResponse({ data: inv.company_id, error: null });
      }

      // 8. decline_invitation
      if (rpcName === "decline_invitation") {
        const { _token } = body;
        await query("UPDATE invitations SET status = 'declined', responded_at = NOW() WHERE token = ?", [_token]);
        return jsonResponse({ data: null, error: null });
      }

      return jsonResponse({ error: { message: `Unknown RPC function: ${rpcName}` } }, 404);
    }

    // -------------------------------------------------------------
    // DATA CRUD ROUTES
    // -------------------------------------------------------------
    if (path === "/api/data/query" && request.method === "POST") {
      const body = await request.json();
      const { table, select, filters = [], order = [], limit, single = false, maybeSingle = false } = body;

      if (!ALLOWED_TABLES.has(table)) {
        return jsonResponse({ error: { message: `Table ${table} is not accessible.` } }, 400);
      }

      let selectClause = "*";
      if (typeof select === "string" && select.trim() !== "*") {
        const parts = select.split(",").map((s: string) => s.trim()).filter(Boolean);
        const safeParts = parts.filter((s: string) => /^[a-zA-Z0-9_]+$/.test(s));
        if (safeParts.length > 0) {
          selectClause = safeParts.map((s: string) => `\`${s}\``).join(", ");
        }
      }

      let sql = `SELECT ${selectClause} FROM \`${table}\``;
      const params: any[] = [];

      if (Array.isArray(filters) && filters.length > 0) {
        const whereClauses: string[] = [];
        for (const f of filters) {
          if (!/^[a-zA-Z0-9_]+$/.test(f.column)) continue;
          if (f.op === "eq") {
            whereClauses.push(`\`${f.column}\` = ?`);
            params.push(f.value);
          } else if (f.op === "neq") {
            whereClauses.push(`\`${f.column}\` != ?`);
            params.push(f.value);
          } else if (f.op === "is" && f.value === null) {
            whereClauses.push(`\`${f.column}\` IS NULL`);
          } else if (f.op === "isNot" && f.value === null) {
            whereClauses.push(`\`${f.column}\` IS NOT NULL`);
          } else if (f.op === "in" && Array.isArray(f.value)) {
            if (f.value.length === 0) {
              whereClauses.push("1 = 0");
            } else {
              const placeholders = f.value.map(() => "?").join(", ");
              whereClauses.push(`\`${f.column}\` IN (${placeholders})`);
              params.push(...f.value);
            }
          }
        }
        if (whereClauses.length > 0) {
          sql += ` WHERE ${whereClauses.join(" AND ")}`;
        }
      }

      if (Array.isArray(order) && order.length > 0) {
        const orderClauses: string[] = [];
        for (const o of order) {
          if (!/^[a-zA-Z0-9_]+$/.test(o.column)) continue;
          const dir = o.ascending ? "ASC" : "DESC";
          orderClauses.push(`\`${o.column}\` ${dir}`);
        }
        if (orderClauses.length > 0) {
          sql += ` ORDER BY ${orderClauses.join(", ")}`;
        }
      }

      if (typeof limit === "number" && limit > 0) {
        sql += ` LIMIT ${Number(limit)}`;
      }

      const rows = await query(sql, params);
      const parsedRows = rows.map(parseJsonRow);

      // Handle Supabase-like relational joins
      if (typeof select === "string") {
        if (table === "calculations" && select.includes("projects")) {
          const projectIds = Array.from(new Set(parsedRows.map((r) => r.project_id).filter(Boolean)));
          if (projectIds.length > 0) {
            const placeholders = projectIds.map(() => "?").join(", ");
            const projectRows = await query<any>(
              `SELECT id, name, client_name FROM projects WHERE id IN (${placeholders})`,
              projectIds
            );
            const pMap = new Map(projectRows.map((p) => [p.id, { name: p.name, client_name: p.client_name }]));
            for (const r of parsedRows) {
              r.projects = r.project_id ? (pMap.get(r.project_id) || null) : null;
            }
          } else {
            for (const r of parsedRows) {
              r.projects = null;
            }
          }
        } else if (table === "projects" && select.includes("calculations")) {
          const projectIds = Array.from(new Set(parsedRows.map((r) => r.id).filter(Boolean)));
          if (projectIds.length > 0) {
            const placeholders = projectIds.map(() => "?").join(", ");
            const calcRows = await query<any>(
              `SELECT id, project_id, version, results FROM calculations WHERE project_id IN (${placeholders})`,
              projectIds
            );
            const cMap = new Map<string, any[]>();
            for (const c of calcRows) {
              if (!cMap.has(c.project_id)) cMap.set(c.project_id, []);
              cMap.get(c.project_id)!.push(parseJsonRow(c));
            }
            for (const r of parsedRows) {
              r.calculations = cMap.get(r.id) || [];
            }
          } else {
            for (const r of parsedRows) {
              r.calculations = [];
            }
          }
        }
      }

      if (single) {
        if (parsedRows.length === 0) {
          return jsonResponse({ data: null, error: { message: "No rows found" } }, 404);
        }
        return jsonResponse({ data: parsedRows[0], error: null });
      }

      if (maybeSingle) {
        return jsonResponse({ data: parsedRows.length > 0 ? parsedRows[0] : null, error: null });
      }

      return jsonResponse({ data: parsedRows, error: null });
    }

    if (path === "/api/data/insert" && request.method === "POST") {
      const body = await request.json();
      const { table, data } = body;

      if (!ALLOWED_TABLES.has(table)) {
        return jsonResponse({ error: { message: `Table ${table} is not accessible.` } }, 400);
      }

      const records = Array.isArray(data) ? data : [data];
      const insertedRows: any[] = [];

      for (const rec of records) {
        const insertRecord = { ...rec };
        if (!insertRecord.id) {
          insertRecord.id = crypto.randomUUID();
        }

        const keys: string[] = [];
        const values: any[] = [];
        for (const [key, val] of Object.entries(insertRecord)) {
          if (!/^[a-zA-Z0-9_]+$/.test(key)) continue;
          keys.push(`\`${key}\``);
          if (JSON_COLUMNS.has(key) && typeof val === "object" && val !== null) {
            values.push(JSON.stringify(val));
          } else {
            values.push(val);
          }
        }

        const placeholders = keys.map(() => "?").join(", ");
        const sql = `INSERT INTO \`${table}\` (${keys.join(", ")}) VALUES (${placeholders})`;

        await query(sql, values);
        const inserted = await queryOne(`SELECT * FROM \`${table}\` WHERE id = ?`, [insertRecord.id]);
        insertedRows.push(parseJsonRow(inserted));
      }

      return jsonResponse({
        data: Array.isArray(data) ? insertedRows : insertedRows[0],
        error: null,
      });
    }

    if (path === "/api/data/update" && request.method === "POST") {
      const body = await request.json();
      const { table, data, filters = [] } = body;

      if (!ALLOWED_TABLES.has(table)) {
        return jsonResponse({ error: { message: `Table ${table} is not accessible.` } }, 400);
      }

      const setClauses: string[] = [];
      const params: any[] = [];

      for (const [key, val] of Object.entries(data)) {
        if (!/^[a-zA-Z0-9_]+$/.test(key)) continue;
        if (key === "id") continue; // Never update PK
        setClauses.push(`\`${key}\` = ?`);
        if (JSON_COLUMNS.has(key) && typeof val === "object" && val !== null) {
          params.push(JSON.stringify(val));
        } else {
          params.push(val);
        }
      }

      if (setClauses.length === 0) {
        return jsonResponse({ data: null, error: { message: "No fields to update" } }, 400);
      }

      let sql = `UPDATE \`${table}\` SET ${setClauses.join(", ")}`;

      if (Array.isArray(filters) && filters.length > 0) {
        const whereClauses: string[] = [];
        for (const f of filters) {
          if (!/^[a-zA-Z0-9_]+$/.test(f.column)) continue;
          if (f.op === "eq") {
            whereClauses.push(`\`${f.column}\` = ?`);
            params.push(f.value);
          }
        }
        if (whereClauses.length > 0) {
          sql += ` WHERE ${whereClauses.join(" AND ")}`;
        }
      }

      await query(sql, params);

      // If updating by ID, return the updated row
      const idFilter = filters.find((f: any) => f.column === "id" && f.op === "eq");
      let updatedRow = null;
      if (idFilter) {
        updatedRow = await queryOne(`SELECT * FROM \`${table}\` WHERE id = ?`, [idFilter.value]);
      }

      return jsonResponse({ data: parseJsonRow(updatedRow), error: null });
    }

    if (path === "/api/data/delete" && request.method === "POST") {
      const body = await request.json();
      const { table, filters = [] } = body;

      if (!ALLOWED_TABLES.has(table)) {
        return jsonResponse({ error: { message: `Table ${table} is not accessible.` } }, 400);
      }

      let sql = `DELETE FROM \`${table}\``;
      const params: any[] = [];

      if (Array.isArray(filters) && filters.length > 0) {
        const whereClauses: string[] = [];
        for (const f of filters) {
          if (!/^[a-zA-Z0-9_]+$/.test(f.column)) continue;
          if (f.op === "eq") {
            whereClauses.push(`\`${f.column}\` = ?`);
            params.push(f.value);
          }
        }
        if (whereClauses.length > 0) {
          sql += ` WHERE ${whereClauses.join(" AND ")}`;
        }
      }

      await query(sql, params);
      return jsonResponse({ data: null, error: null });
    }

    return jsonResponse({ error: { message: `Route ${path} not found` } }, 404);
  } catch (err: any) {
    const requestId = crypto.randomUUID();
    console.error(`API error [${requestId}]:`, err);
    return jsonResponse({ error: { message: `Internal server error. Reference: ${requestId}` } }, 500);
  }
}
