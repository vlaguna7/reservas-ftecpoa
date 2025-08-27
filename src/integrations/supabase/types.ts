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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      admin_alerts: {
        Row: {
          created_at: string
          duration: number
          expires_at: string | null
          id: string
          is_active: boolean
          message: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown | null
          severity: string | null
          target_user_email: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          severity?: string | null
          target_user_email?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          severity?: string | null
          target_user_email?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      equipment_settings: {
        Row: {
          id: string
          projector_limit: number
          speaker_limit: number
          updated_at: string
        }
        Insert: {
          id?: string
          projector_limit?: number
          speaker_limit?: number
          updated_at?: string
        }
        Update: {
          id?: string
          projector_limit?: number
          speaker_limit?: number
          updated_at?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          created_at: string
          id: string
          is_active: boolean
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          is_active?: boolean
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          is_active?: boolean
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      laboratory_settings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          laboratory_code: string | null
          laboratory_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          laboratory_code?: string | null
          laboratory_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          laboratory_code?: string | null
          laboratory_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          classroom_friday: string | null
          classroom_monday: string | null
          classroom_thursday: string | null
          classroom_tuesday: string | null
          classroom_wednesday: string | null
          created_at: string
          display_name: string
          green_tag_text: string | null
          id: string
          institutional_user: string
          is_admin: boolean
          pin_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          classroom_friday?: string | null
          classroom_monday?: string | null
          classroom_thursday?: string | null
          classroom_tuesday?: string | null
          classroom_wednesday?: string | null
          created_at?: string
          display_name: string
          green_tag_text?: string | null
          id?: string
          institutional_user: string
          is_admin?: boolean
          pin_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          classroom_friday?: string | null
          classroom_monday?: string | null
          classroom_thursday?: string | null
          classroom_tuesday?: string | null
          classroom_wednesday?: string | null
          created_at?: string
          display_name?: string
          green_tag_text?: string | null
          id?: string
          institutional_user?: string
          is_admin?: boolean
          pin_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          created_at: string
          equipment_type: string
          id: string
          observation: string | null
          reservation_date: string
          time_slots: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          equipment_type: string
          id?: string
          observation?: string | null
          reservation_date: string
          time_slots?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          equipment_type?: string
          id?: string
          observation?: string | null
          reservation_date?: string
          time_slots?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: unknown | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_viewed_alerts: {
        Row: {
          alert_id: string
          created_at: string
          id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          alert_id: string
          created_at?: string
          id?: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          alert_id?: string
          created_at?: string
          id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_viewed_alerts_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "admin_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      reservation_availability: {
        Row: {
          created_at: string | null
          equipment_type: string | null
          reservation_date: string | null
          status: string | null
          time_slots: string[] | null
        }
        Insert: {
          created_at?: string | null
          equipment_type?: string | null
          reservation_date?: string | null
          status?: never
          time_slots?: string[] | null
        }
        Update: {
          created_at?: string | null
          equipment_type?: string | null
          reservation_date?: string | null
          status?: never
          time_slots?: string[] | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_admin_elevation_attempts: {
        Args: Record<PropertyKey, never>
        Returns: {
          attempt_count: number
          last_attempt: string
          suspicious_user_id: string
        }[]
      }
      check_institutional_user_exists: {
        Args: { p_institutional_user: string }
        Returns: boolean
      }
      cleanup_rate_limits: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_equipment_availability: {
        Args: { p_date: string; p_equipment_type: string }
        Returns: {
          equipment_type: string
          is_available: boolean
          reservation_date: string
          time_slots: string[]
        }[]
      }
      get_equipment_availability_secure: {
        Args: { p_date: string; p_equipment_type: string }
        Returns: {
          equipment_type: string
          is_available: boolean
          reservation_date: string
          time_slots: string[]
          user_count: number
        }[]
      }
      get_profile_display_name: {
        Args: { p_user_id: string }
        Returns: string
      }
      handle_signup_with_profile: {
        Args: {
          p_display_name: string
          p_institutional_user: string
          p_pin_hash: string
          p_user_id: string
        }
        Returns: undefined
      }
      is_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      is_admin_secure: {
        Args: { user_id: string }
        Returns: boolean
      }
      log_privilege_attempt: {
        Args: {
          action_attempted: string
          request_details?: Json
          target_user_id: string
        }
        Returns: undefined
      }
      verify_user_login: {
        Args: { p_institutional_user: string; p_pin: string }
        Returns: {
          display_name: string
          institutional_user: string
          is_admin: boolean
          pin_hash: string
          user_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
