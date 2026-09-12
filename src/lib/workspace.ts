import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CostPolicy, EmployeeRecord, OverheadRecord } from "@/lib/pricing";
import { COST_MANAGE_ROLES, EDIT_ROLES, FINANCE_VIEW_ROLES } from "@/lib/roles";

export interface WorkspaceData {
  userId: string;
  email: string | null;
  fullName: string | null;
  company: { id: string; name: string; industry: string | null; currency: string } | null;
  roles: string[];
  policy: CostPolicy | null;
  canEdit: boolean;
  canViewFinance: boolean;
  canManageCosts: boolean;
  isAdmin: boolean;
}

export interface TeamRate {
  id: string;
  name: string;
  job_title: string | null;
  department: string | null;
  seniority: string | null;
  skills: string[];
  active: boolean;
  hourly_cost: number;
}

export const useSession = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { userId, loading };
};

export const fetchWorkspace = async (): Promise<WorkspaceData | null> => {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, company_id")
    .eq("id", user.id)
    .maybeSingle();

  let company = null;
  let policy: CostPolicy | null = null;
  let roles: string[] = [];

  if (profile?.company_id) {
    const [{ data: companyRow }, { data: policyRow }, { data: roleRows }] = await Promise.all([
      supabase
        .from("companies")
        .select("id, name, industry, currency")
        .eq("id", profile.company_id)
        .maybeSingle(),
      supabase.from("cost_policies").select("*").eq("company_id", profile.company_id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    company = companyRow ?? null;
    policy = (policyRow as unknown as CostPolicy) ?? null;
    roles = (roleRows ?? []).map((r) => r.role as string);
  }

  const has = (list: string[]) => roles.some((r) => list.includes(r));

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name ?? (user.user_metadata?.["full_name"] as string) ?? null,
    company,
    roles,
    policy,
    canEdit: has(EDIT_ROLES),
    canViewFinance: has(FINANCE_VIEW_ROLES),
    canManageCosts: has(COST_MANAGE_ROLES),
    isAdmin: roles.includes("admin"),
  };
};

export const useWorkspace = () =>
  useQuery({
    queryKey: ["workspace"],
    queryFn: fetchWorkspace,
    staleTime: 30_000,
    // Permission changes made by an admin land here without the person signing out.
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

export const useEmployees = (companyId?: string) =>
  useQuery({
    queryKey: ["employees", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<EmployeeRecord[]> => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("company_id", companyId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as EmployeeRecord[];
    },
  });

/** Salary-free view of the team with each person's calculated hourly cost. */
export const useTeamRates = (companyId?: string) =>
  useQuery({
    queryKey: ["team-rates", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<TeamRate[]> => {
      const { data, error } = await supabase.rpc("company_employee_rates");
      if (error) throw error;
      return ((data ?? []) as TeamRate[]).map((r) => ({
        ...r,
        skills: r.skills ?? [],
        hourly_cost: Number(r.hourly_cost ?? 0),
      }));
    },
  });

export const useOverheads = (companyId?: string) =>
  useQuery({
    queryKey: ["overheads", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<OverheadRecord[]> => {
      const { data, error } = await supabase
        .from("overheads")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as OverheadRecord[];
    },
  });

export const useInvalidate = () => {
  const qc = useQueryClient();
  return (keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
};

export interface ScopeFeatureRecord {
  id: string;
  company_id: string | null;
  category: string;
  label: string;
  description: string;
  effort: {
    low: { designer: number; frontend: number; backend: number; mobile: number; pm: number; qa: number };
    medium: { designer: number; frontend: number; backend: number; mobile: number; pm: number; qa: number };
    high: { designer: number; frontend: number; backend: number; mobile: number; pm: number; qa: number };
  };
  icon: string;
  tags: string[];
  sort_order: number;
  is_custom: boolean;
  created_at?: string;
  updated_at?: string;
}

export const useScopeFeatures = (companyId?: string) =>
  useQuery({
    queryKey: ["scope-features", companyId],
    queryFn: async (): Promise<ScopeFeatureRecord[]> => {
      const { data, error } = await supabase
        .from("scope_features")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) {
        console.warn("Failed to fetch scope features from DB:", error);
        return [];
      }
      return (data ?? []) as ScopeFeatureRecord[];
    },
  });

export const logActivity = async (
  companyId: string,
  action: string,
  entity: string,
  entityId?: string | null,
  details: Record<string, unknown> = {},
) => {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("audit_log").insert({
    company_id: companyId,
    user_id: data.user.id,
    action,
    entity,
    entity_id: entityId ?? null,
    details: details as never,
  });
};
