// Client adapter providing the Supabase-compatible query and auth API backed by MySQL
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

type PublicTables = Database["public"]["Tables"];

export interface UserMetadata {
  full_name?: string;
  [key: string]: any;
}

export interface User {
  id: string;
  email: string;
  user_metadata?: UserMetadata;
  [key: string]: any;
}

export interface Session {
  access_token: string;
  token_type: string;
  user: User;
  [key: string]: any;
}

type AuthChangeEvent = "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED" | "INITIAL_SESSION";
type AuthStateListener = (event: AuthChangeEvent, session: Session | null) => void;

const SESSION_STORAGE_KEY = "costcraft_mysql_session";
const authListeners = new Set<AuthStateListener>();

function getStoredSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredSession(session: Session | null) {
  if (typeof window === "undefined") return;
  try {
    if (session) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

function notifyAuthListeners(event: AuthChangeEvent, session: Session | null) {
  for (const listener of authListeners) {
    try {
      listener(event, session);
    } catch (e) {
      console.error("Auth listener error:", e);
    }
  }
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const session = getStoredSession();
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  return fetch(path, { ...options, headers });
}

export class QueryBuilder<TRow = any> {
  private table: string;
  private op: "query" | "insert" | "update" | "delete" = "query";
  private selectCols: string = "*";
  private insertData: any = null;
  private updateData: any = null;
  private filters: Array<{ column: string; op: string; value: any }> = [];
  private orderClauses: Array<{ column: string; ascending: boolean }> = [];
  private limitCount?: number;
  private isSingle = false;
  private isMaybeSingle = false;

  constructor(table: string) {
    this.table = table;
  }

  select<TResult = any>(columns: string = "*"): QueryBuilder<TResult> {
    this.selectCols = columns;
    return this as unknown as QueryBuilder<TResult>;
  }

  insert(data: any): this {
    this.op = "insert";
    this.insertData = data;
    return this;
  }

  update(data: any): this {
    this.op = "update";
    this.updateData = data;
    return this;
  }

  delete(): this {
    this.op = "delete";
    return this;
  }

  eq(column: string, value: any): this {
    this.filters.push({ column, op: "eq", value });
    return this;
  }

  neq(column: string, value: any): this {
    this.filters.push({ column, op: "neq", value });
    return this;
  }

  is(column: string, value: any): this {
    this.filters.push({ column, op: "is", value });
    return this;
  }

  in(column: string, values: any[]): this {
    this.filters.push({ column, op: "in", value: values });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}): this {
    this.orderClauses.push({ column, ascending: options.ascending !== false });
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  single(): Promise<{ data: TRow; error: any }> {
    this.isSingle = true;
    return this.execute() as Promise<{ data: TRow; error: any }>;
  }

  maybeSingle(): Promise<{ data: TRow | null; error: any }> {
    this.isMaybeSingle = true;
    return this.execute() as Promise<{ data: TRow | null; error: any }>;
  }

  async execute(): Promise<{ data: any; error: any }> {
    try {
      if (this.op === "insert") {
        const res = await apiFetch("/api/data/insert", {
          method: "POST",
          body: JSON.stringify({ table: this.table, data: this.insertData }),
        });
        const json = await res.json();
        return { data: json.data, error: json.error || null };
      }

      if (this.op === "update") {
        const res = await apiFetch("/api/data/update", {
          method: "POST",
          body: JSON.stringify({ table: this.table, data: this.updateData, filters: this.filters }),
        });
        const json = await res.json();
        return { data: json.data, error: json.error || null };
      }

      if (this.op === "delete") {
        const res = await apiFetch("/api/data/delete", {
          method: "POST",
          body: JSON.stringify({ table: this.table, filters: this.filters }),
        });
        const json = await res.json();
        return { data: json.data, error: json.error || null };
      }

      // Default: query (select)
      const res = await apiFetch("/api/data/query", {
        method: "POST",
        body: JSON.stringify({
          table: this.table,
          select: this.selectCols,
          filters: this.filters,
          order: this.orderClauses,
          limit: this.limitCount,
          single: this.isSingle,
          maybeSingle: this.isMaybeSingle,
        }),
      });
      const json = await res.json();
      return { data: json.data, error: json.error || null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || "Network request failed" } };
    }
  }

  // Support awaiting the builder directly without .single() or .maybeSingle()
  then<TResult1 = { data: TRow[]; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: TRow[]; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return (this.execute() as Promise<{ data: TRow[]; error: any }>).then(onfulfilled, onrejected);
  }
}

export interface SupabaseClient {
  auth: {
    getSession(): Promise<{ data: { session: Session | null }; error: any }>;
    getUser(): Promise<{ data: { user: User | null }; error: any }>;
    signInWithPassword(credentials: { email: string; password: string }): Promise<{ data: { user: User | null; session: Session | null }; error: any }>;
    signUp(credentials: { email: string; password: string; options?: { data?: { full_name?: string }; emailRedirectTo?: string } }): Promise<{ data: { user: User | null; session: Session | null }; error: any }>;
    signOut(): Promise<{ error: any }>;
    signInWithOAuth(params: { provider: string; options?: any }): Promise<{ data: null; error: any }>;
    onAuthStateChange(callback: AuthStateListener): { data: { subscription: { unsubscribe: () => void } } };
  };
  from<TName extends keyof PublicTables>(table: TName): QueryBuilder<PublicTables[TName]["Row"]>;
  from<T = any>(table: string): QueryBuilder<T>;
  rpc(name: string, params?: Record<string, any>): Promise<{ data: any; error: any }>;
}

const mysqlSupabase: SupabaseClient = {
  auth: {
    async getSession(): Promise<{ data: { session: Session | null }; error: any }> {
      const session = getStoredSession();
      return { data: { session }, error: null };
    },

    async getUser(): Promise<{ data: { user: User | null }; error: any }> {
      const session = getStoredSession();
      if (!session?.user) {
        return { data: { user: null }, error: null };
      }
      return { data: { user: session.user }, error: null };
    },

    async signInWithPassword({ email, password }: { email: string; password: string }) {
      try {
        const res = await apiFetch("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        const json = await res.json();
        if (json.error) {
          return { data: { user: null, session: null }, error: json.error };
        }
        setStoredSession(json.data.session);
        notifyAuthListeners("SIGNED_IN", json.data.session);
        return { data: json.data, error: null };
      } catch (err: any) {
        return { data: { user: null, session: null }, error: { message: err.message } };
      }
    },

    async signUp({
      email,
      password,
      options,
    }: {
      email: string;
      password: string;
      options?: { data?: { full_name?: string }; emailRedirectTo?: string };
    }) {
      try {
        const res = await apiFetch("/api/auth/signup", {
          method: "POST",
          body: JSON.stringify({ email, password, options }),
        });
        const json = await res.json();
        if (json.error) {
          return { data: { user: null, session: null }, error: json.error };
        }
        setStoredSession(json.data.session);
        notifyAuthListeners("SIGNED_IN", json.data.session);
        return { data: json.data, error: null };
      } catch (err: any) {
        return { data: { user: null, session: null }, error: { message: err.message } };
      }
    },

    async signOut() {
      try {
        await apiFetch("/api/auth/logout", { method: "POST" });
      } catch {
        // ignore network error on logout
      }
      setStoredSession(null);
      notifyAuthListeners("SIGNED_OUT", null);
      return { error: null };
    },

    async signInWithOAuth(_params: { provider: string; options?: any }) {
      return {
        data: null,
        error: { message: "OAuth sign-in is disabled. Please sign in with your email and password." },
      };
    },

    onAuthStateChange(callback: AuthStateListener) {
      authListeners.add(callback);
      const session = getStoredSession();
      callback("INITIAL_SESSION", session);

      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(callback);
            },
          },
        },
      };
    },
  },

  from(table: any): any {
    return new QueryBuilder(table);
  },

  async rpc(name: string, params: Record<string, any> = {}): Promise<{ data: any; error: any }> {
    try {
      const res = await apiFetch(`/api/rpc/${name}`, {
        method: "POST",
        body: JSON.stringify(params),
      });
      const json = await res.json();
      return { data: json.data, error: json.error || null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || "RPC failed" } };
    }
  },
};

const useSupabaseBackend = import.meta.env.VITE_BACKEND === "supabase";
const supabaseBackend =
  useSupabaseBackend && import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_KEY
    ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY)
    : null;

if (useSupabaseBackend && !supabaseBackend) {
  throw new Error("Supabase backend is enabled but VITE_SUPABASE_URL or VITE_SUPABASE_KEY is missing.");
}

export const supabase: SupabaseClient = (supabaseBackend ?? mysqlSupabase) as unknown as SupabaseClient;
