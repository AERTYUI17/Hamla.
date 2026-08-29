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
      campaigns: {
        Row: {
          beneficiary: string | null
          category: string | null
          certified: boolean
          certified_at: string | null
          certified_by: string | null
          charity_group_id: string | null
          cover_image: string | null
          created_at: string
          currency: string
          description: string | null
          donor_count: number
          goal_amount: number
          id: string
          location: string | null
          organizer_avatar: string | null
          organizer_id: string | null
          organizer_name: string
          organizer_relation: string | null
          raised_amount: number
          slug: string
          status: Database["public"]["Enums"]["campaign_status"]
          story: string | null
          title: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          beneficiary?: string | null
          category?: string | null
          certified?: boolean
          certified_at?: string | null
          certified_by?: string | null
          charity_group_id?: string | null
          cover_image?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          donor_count?: number
          goal_amount?: number
          id?: string
          location?: string | null
          organizer_avatar?: string | null
          organizer_id?: string | null
          organizer_name?: string
          organizer_relation?: string | null
          raised_amount?: number
          slug: string
          status?: Database["public"]["Enums"]["campaign_status"]
          story?: string | null
          title: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          beneficiary?: string | null
          category?: string | null
          certified?: boolean
          certified_at?: string | null
          certified_by?: string | null
          charity_group_id?: string | null
          cover_image?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          donor_count?: number
          goal_amount?: number
          id?: string
          location?: string | null
          organizer_avatar?: string | null
          organizer_id?: string | null
          organizer_name?: string
          organizer_relation?: string | null
          raised_amount?: number
          slug?: string
          status?: Database["public"]["Enums"]["campaign_status"]
          story?: string | null
          title?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      donations: {
        Row: {
          amount: number
          anonymous: boolean
          campaign_id: string
          charity_group_id: string | null
          created_at: string
          currency: string
          donor_email: string | null
          donor_name: string | null
          id: string
          message: string | null
          paid_at: string | null
          payment_provider: string | null
          reference: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          anonymous?: boolean
          campaign_id: string
          charity_group_id?: string | null
          created_at?: string
          currency?: string
          donor_email?: string | null
          donor_name?: string | null
          id?: string
          message?: string | null
          paid_at?: string | null
          payment_provider?: string | null
          reference: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          anonymous?: boolean
          campaign_id?: string
          charity_group_id?: string | null
          created_at?: string
          currency?: string
          donor_email?: string | null
          donor_name?: string | null
          id?: string
          message?: string | null
          paid_at?: string | null
          payment_provider?: string | null
          reference?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          currency: string
          donation_id: string
          emailed_at: string | null
          id: string
          invoice_number: string
          issued_at: string
          reference: string
        }
        Insert: {
          amount: number
          currency?: string
          donation_id: string
          emailed_at?: string | null
          id?: string
          invoice_number: string
          issued_at?: string
          reference: string
        }
        Update: {
          amount?: number
          currency?: string
          donation_id?: string
          emailed_at?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string
          reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_donation_id_fkey"
            columns: ["donation_id"]
            isOneToOne: true
            referencedRelation: "donations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          donation_id: string
          id: string
          provider: string
          provider_transaction_id: string | null
          raw: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          donation_id: string
          id?: string
          provider: string
          provider_transaction_id?: string | null
          raw?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          donation_id?: string
          id?: string
          provider?: string
          provider_transaction_id?: string | null
          raw?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_donation_id_fkey"
            columns: ["donation_id"]
            isOneToOne: false
            referencedRelation: "donations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          updated_at?: string
        }
        Relationships: []
      },
      user_roles: {
        Row: { granted_at: string; granted_by: string | null; role: Database["public"]["Enums"]["user_role"]; user_id: string }
        Insert: { granted_at?: string; granted_by?: string | null; role: Database["public"]["Enums"]["user_role"]; user_id: string }
        Update: { granted_at?: string; granted_by?: string | null; role?: Database["public"]["Enums"]["user_role"]; user_id?: string }
        Relationships: []
      },
      charity_groups: {
        Row: {
          address: string | null; category: string | null; commune: string | null; created_at: string;
          description: string | null; email: string | null; id: string; logo_url: string | null;
          name: string; phone: string | null; registration_date: string | null;
          registration_number: string | null; representative_email: string | null;
          representative_name: string | null; representative_phone: string | null;
          slug: string; status: Database["public"]["Enums"]["charity_status"]; updated_at: string;
          user_id: string; verified: boolean; verified_at: string | null; website: string | null; wilaya: string | null
        }
        Insert: {
          address?: string | null; category?: string | null; commune?: string | null; created_at?: string;
          description?: string | null; email?: string | null; id?: string; logo_url?: string | null;
          name: string; phone?: string | null; registration_date?: string | null;
          registration_number?: string | null; representative_email?: string | null;
          representative_name?: string | null; representative_phone?: string | null;
          slug: string; status?: Database["public"]["Enums"]["charity_status"]; updated_at?: string;
          user_id: string; verified?: boolean; verified_at?: string | null; website?: string | null; wilaya?: string | null
        }
        Update: {
          address?: string | null; category?: string | null; commune?: string | null; created_at?: string;
          description?: string | null; email?: string | null; id?: string; logo_url?: string | null;
          name?: string; phone?: string | null; registration_date?: string | null;
          registration_number?: string | null; representative_email?: string | null;
          representative_name?: string | null; representative_phone?: string | null;
          slug?: string; status?: Database["public"]["Enums"]["charity_status"]; updated_at?: string;
          user_id?: string; verified?: boolean; verified_at?: string | null; website?: string | null; wilaya?: string | null
        }
        Relationships: []
      },
      charity_applications: {
        Row: {
          admin_notes: string | null; charity_group_id: string | null; id: string;
          org_address: string; org_category: string; org_commune: string; org_description: string | null;
          org_email: string; org_name: string; org_name_ar: string; org_phone: string; org_website: string | null;
          org_wilaya: string; registration_date: string | null; registration_number: string | null; rep_email: string;
          rep_name: string; rep_phone: string; reviewed_at: string | null; reviewed_by: string | null;
          status: Database["public"]["Enums"]["app_status"]; submitted_at: string; user_id: string
        }
        Insert: {
          admin_notes?: string | null; charity_group_id?: string | null; id?: string;
          org_address: string; org_category: string; org_commune: string; org_description?: string | null;
          org_email: string; org_name: string; org_name_ar: string; org_phone: string; org_website?: string | null;
          org_wilaya: string; registration_date?: string | null; registration_number?: string | null; rep_email: string;
          rep_name: string; rep_phone: string; reviewed_at?: string | null; reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["app_status"]; submitted_at?: string; user_id: string
        }
        Update: {
          admin_notes?: string | null; charity_group_id?: string | null; id?: string;
          org_address?: string; org_category?: string; org_commune?: string; org_description?: string | null;
          org_email?: string; org_name?: string; org_name_ar?: string; org_phone?: string; org_website?: string | null;
          org_wilaya?: string; registration_date?: string | null; registration_number?: string | null; rep_email?: string;
          rep_name?: string; rep_phone?: string; reviewed_at?: string | null; reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["app_status"]; submitted_at?: string; user_id?: string
        }
        Relationships: []
      },
      charity_documents: {
        Row: {
          charity_application_id: string; id: string; mime_type: string; original_filename: string | null;
          size_bytes: number; storage_path: string; type: string; uploaded_at: string
        }
        Insert: {
          charity_application_id: string; id?: string; mime_type: string; original_filename?: string | null;
          size_bytes: number; storage_path: string; type: string; uploaded_at?: string
        }
        Update: {
          charity_application_id?: string; id?: string; mime_type?: string; original_filename?: string | null;
          size_bytes?: number; storage_path?: string; type?: string; uploaded_at?: string
        }
        Relationships: []
      },
      payouts: {
        Row: {
          amount: number; approved_at: string | null; approved_by: string | null;
          campaign_id: string | null; charity_group_id: string; created_at: string; currency: string;
          destination: Json; external_reference: string | null; id: string; notes: string | null;
          paid_at: string | null; paid_by: string | null; rejection_reason: string | null;
          requested_at: string; status: Database["public"]["Enums"]["payout_status"]
        }
        Insert: {
          amount: number; approved_at?: string | null; approved_by?: string | null;
          campaign_id?: string | null; charity_group_id: string; created_at?: string; currency?: string;
          destination: Json; external_reference?: string | null; id?: string; notes?: string | null;
          paid_at?: string | null; paid_by?: string | null; rejection_reason?: string | null;
          requested_at?: string; status?: Database["public"]["Enums"]["payout_status"]
        }
        Update: {
          amount?: number; approved_at?: string | null; approved_by?: string | null;
          campaign_id?: string | null; charity_group_id?: string; created_at?: string; currency?: string;
          destination?: Json; external_reference?: string | null; id?: string; notes?: string | null;
          paid_at?: string | null; paid_by?: string | null; rejection_reason?: string | null;
          requested_at?: string; status?: Database["public"]["Enums"]["payout_status"]
        }
        Relationships: []
      },
      ledger_entries: {
        Row: {
          amount: number; campaign_id: string | null; charity_group_id: string | null;
          created_at: string; created_by: string | null; currency: string; donation_id: string | null;
          id: string; payout_id: string | null; reference: string | null; status: string;
          type: Database["public"]["Enums"]["ledger_type"]
        }
        Insert: {
          amount: number; campaign_id?: string | null; charity_group_id?: string | null;
          created_at?: string; created_by?: string | null; currency?: string; donation_id?: string | null;
          id?: string; payout_id?: string | null; reference?: string | null; status?: string;
          type: Database["public"]["Enums"]["ledger_type"]
        }
        Update: {
          amount?: number; campaign_id?: string | null; charity_group_id?: string | null;
          created_at?: string; created_by?: string | null; currency?: string; donation_id?: string | null;
          id?: string; payout_id?: string | null; reference?: string | null; status?: string;
          type?: Database["public"]["Enums"]["ledger_type"]
        }
        Relationships: []
      },
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]; admin_id: string; created_at: string;
          id: string; metadata: Json; target_id: string; target_type: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]; admin_id: string; created_at?: string;
          id?: string; metadata?: Json; target_id: string; target_type: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]; admin_id?: string; created_at?: string;
          id?: string; metadata?: Json; target_id?: string; target_type?: string
        }
        Relationships: []
      },
      notifications: {
        Row: {
          created_at: string; id: string; message: string; read: boolean; read_at: string | null;
          title: string; type: string; user_id: string
        }
        Insert: {
          created_at?: string; id?: string; message: string; read?: boolean; read_at?: string | null;
          title: string; type: string; user_id: string
        }
        Update: {
          created_at?: string; id?: string; message?: string; read?: boolean; read_at?: string | null;
          title?: string; type?: string; user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      campaign_donations: {
        Args: { _limit?: number; _order?: string; _slug: string }
        Returns: {
          amount: number
          created_at: string
          donor_name: string
          id: string
          message: string
        }[]
      }
      finalize_donation: {
        Args: { _provider_txn?: string; _reference: string; _status: string }
        Returns: Json
      }
      has_role: { Args: { _role: Database["public"]["Enums"]["user_role"]; _user_id: string }; Returns: boolean }
      get_my_role: { Args: Record<PropertyKey, never>; Returns: Database["public"]["Enums"]["user_role"] }
      approve_charity_application: { Args: { _application_id: string; _notes?: string | null; _reviewer_id: string }; Returns: string }
      reject_charity_application: { Args: { _application_id: string; _reason: string; _reviewer_id: string }; Returns: undefined }
      request_more_info: { Args: { _application_id: string; _notes: string; _reviewer_id: string }; Returns: undefined }
      certify_campaign: { Args: { _admin_id: string; _campaign_id: string }; Returns: undefined }
      remove_campaign_certification: { Args: { _admin_id: string; _campaign_id: string; _reason: string }; Returns: undefined }
      publish_campaign: { Args: { _admin_id: string; _campaign_id: string }; Returns: undefined }
      reject_campaign: { Args: { _admin_id: string; _campaign_id: string; _reason: string }; Returns: undefined }
      suspend_campaign: { Args: { _admin_id: string; _campaign_id: string; _reason: string }; Returns: undefined }
      reactivate_campaign: { Args: { _admin_id: string; _campaign_id: string }; Returns: undefined }
      request_payout: { Args: { _amount: number; _charity_group_id: string; _currency: string; _destination: Json }; Returns: string }
      approve_payout: { Args: { _admin_id: string; _payout_id: string }; Returns: undefined }
      reject_payout: { Args: { _admin_id: string; _payout_id: string; _reason: string }; Returns: undefined }
      mark_payout_paid: { Args: { _admin_id: string; _external_reference: string; _payout_id: string }; Returns: undefined }
      get_charity_balances: { Args: { _charity_group_id: string }; Returns: Json }
    }
    Enums: {
      user_role: "user" | "charity_group" | "admin"
      charity_status: "pending" | "under_review" | "approved" | "rejected" | "more_info_required" | "suspended"
      app_status: "draft" | "submitted" | "under_review" | "approved" | "rejected" | "more_info_required" | "suspended"
      campaign_status: "draft" | "submitted" | "published" | "paused" | "completed" | "rejected" | "suspended" | "archived"
      payout_status: "pending" | "under_review" | "approved" | "processing" | "paid" | "rejected" | "failed"
      ledger_type: "donation" | "payment_fee" | "platform_fee" | "refund" | "payout" | "payout_fee" | "adjustment"
      audit_action: "approve_charity" | "reject_charity" | "suspend_charity" | "approve_campaign" | "reject_campaign" | "certify_campaign" | "remove_certification" | "suspend_campaign" | "approve_payout" | "reject_payout" | "mark_payout_paid" | "suspend_user" | "reactivate_user" | "view_charity_document"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      user_role: ["user", "charity_group", "admin"],
      charity_status: ["pending", "under_review", "approved", "rejected", "more_info_required", "suspended"],
      app_status: ["draft", "submitted", "under_review", "approved", "rejected", "more_info_required", "suspended"],
      campaign_status: ["draft", "submitted", "published", "paused", "completed", "rejected", "suspended", "archived"],
      payout_status: ["pending", "under_review", "approved", "processing", "paid", "rejected", "failed"],
      ledger_type: ["donation", "payment_fee", "platform_fee", "refund", "payout", "payout_fee", "adjustment"],
      audit_action: ["approve_charity", "reject_charity", "suspend_charity", "approve_campaign", "reject_campaign", "certify_campaign", "remove_certification", "suspend_campaign", "approve_payout", "reject_payout", "mark_payout_paid", "suspend_user", "reactivate_user", "view_charity_document"],
    },
  },
} as const
