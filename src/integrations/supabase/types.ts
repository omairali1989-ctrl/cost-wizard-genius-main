export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          company_id: string
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      calculations: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          inputs: Json
          is_snapshot: boolean
          label: string
          project_id: string | null
          results: Json
          updated_at: string
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          inputs?: Json
          is_snapshot?: boolean
          label?: string
          project_id?: string | null
          results?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          inputs?: Json
          is_snapshot?: boolean
          label?: string
          project_id?: string | null
          results?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "calculations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          currency: string
          id: string
          industry: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          industry?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          industry?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      cost_policies: {
        Row: {
          company_id: string
          created_at: string
          default_contingency_pct: number
          default_margin_pct: number
          default_markup_pct: number
          default_utilization_pct: number
          hours_per_day: number
          id: string
          pricing_mode: string
          rounding_step: number
          updated_at: string
          working_days_per_year: number
        }
        Insert: {
          company_id: string
          created_at?: string
          default_contingency_pct?: number
          default_margin_pct?: number
          default_markup_pct?: number
          default_utilization_pct?: number
          hours_per_day?: number
          id?: string
          pricing_mode?: string
          rounding_step?: number
          updated_at?: string
          working_days_per_year?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          default_contingency_pct?: number
          default_margin_pct?: number
          default_markup_pct?: number
          default_utilization_pct?: number
          hours_per_day?: number
          id?: string
          pricing_mode?: string
          rounding_step?: number
          updated_at?: string
          working_days_per_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "cost_policies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          annual_salary: number
          billable_target_pct: number
          company_id: string
          created_at: string
          department: string | null
          employer_cost_pct: number
          id: string
          job_title: string | null
          monthly_salary: number
          name: string
          salary_currency: string
          seniority: string | null
          skills: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          annual_salary?: number
          billable_target_pct?: number
          company_id: string
          created_at?: string
          department?: string | null
          employer_cost_pct?: number
          id?: string
          job_title?: string | null
          monthly_salary?: number
          name: string
          salary_currency?: string
          seniority?: string | null
          skills?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          annual_salary?: number
          billable_target_pct?: number
          company_id?: string
          created_at?: string
          department?: string | null
          employer_cost_pct?: number
          id?: string
          job_title?: string | null
          monthly_salary?: number
          name?: string
          salary_currency?: string
          seniority?: string | null
          skills?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          responded_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          responded_at?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          responded_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      overheads: {
        Row: {
          allocation_basis: string
          category: string | null
          company_id: string
          created_at: string
          id: string
          monthly_amount: number
          period: "monthly" | "yearly"
          name: string
          updated_at: string
        }
        Insert: {
          allocation_basis?: string
          category?: string | null
          company_id: string
          created_at?: string
          id?: string
          monthly_amount?: number
          period?: "monthly" | "yearly"
          name: string
          updated_at?: string
        }
        Update: {
          allocation_basis?: string
          category?: string | null
          company_id?: string
          created_at?: string
          id?: string
          monthly_amount?: number
          period?: "monthly" | "yearly"
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "overheads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_presets: {
        Row: {
          company_id: string
          config: Json
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          config: Json
          created_at?: string
          id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          config?: Json
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_presets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_name: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      scope_features: {
        Row: {
          category: string
          company_id: string | null
          created_at: string
          description: string
          effort: Json
          icon: string
          id: string
          is_custom: boolean
          label: string
          sort_order: number
          tags: string[]
          updated_at: string
        }
        Insert: {
          category: string
          company_id?: string | null
          created_at?: string
          description?: string
          effort?: Json
          icon?: string
          id: string
          is_custom?: boolean
          label: string
          sort_order?: number
          tags?: string[]
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string | null
          created_at?: string
          description?: string
          effort?: Json
          icon?: string
          id?: string
          is_custom?: boolean
          label?: string
          sort_order?: number
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scope_features_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { _token: string }; Returns: string }
      can_edit: { Args: never; Returns: boolean }
      can_manage_costs: { Args: never; Returns: boolean }
      can_view_finance: { Args: never; Returns: boolean }
      company_employee_rates: {
        Args: never
        Returns: {
          active: boolean
          department: string
          hourly_cost: number
          id: string
          job_title: string
          name: string
          seniority: string
          skills: string[]
        }[]
      }
      company_members: {
        Args: never
        Returns: {
          email: string
          full_name: string
          joined_at: string
          roles: string[]
          user_id: string
        }[]
      }
      create_company: {
        Args: { _currency: string; _industry: string; _name: string }
        Returns: string
      }
      current_company_id: { Args: never; Returns: string }
      decline_invitation: { Args: { _token: string }; Returns: undefined }
      has_any_role: { Args: { _roles: string[] }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invitation_preview: {
        Args: { _token: string }
        Returns: {
          company_name: string
          email: string
          expired: boolean
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }[]
      }
      is_company_admin: { Args: never; Returns: boolean }
      remove_member: { Args: { _user_id: string }; Returns: undefined }
      set_member_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "viewer"
        | "finance"
        | "management"
        | "project_manager"
        | "technical_lead"
        | "calculator_user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "manager",
        "viewer",
        "finance",
        "management",
        "project_manager",
        "technical_lead",
        "calculator_user",
      ],
    },
  },
} as const
