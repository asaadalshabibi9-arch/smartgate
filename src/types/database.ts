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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      gates: {
        Row: {
          code: string
          created_at: string
          eligible_operations: string[]
          estimated_wait_minutes: number | null
          id: string
          is_simulated: boolean
          name: string
          queue_length: number | null
          status: Database["public"]["Enums"]["gate_status"]
          telemetry_updated_at: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          eligible_operations?: string[]
          estimated_wait_minutes?: number | null
          id?: string
          is_simulated?: boolean
          name: string
          queue_length?: number | null
          status?: Database["public"]["Enums"]["gate_status"]
          telemetry_updated_at?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          eligible_operations?: string[]
          estimated_wait_minutes?: number | null
          id?: string
          is_simulated?: boolean
          name?: string
          queue_length?: number | null
          status?: Database["public"]["Enums"]["gate_status"]
          telemetry_updated_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          channel: string
          created_at: string
          delivered_at: string | null
          id: number
          is_simulated: boolean
          purpose: string
          recipient_profile_id: string | null
          status: Database["public"]["Enums"]["notification_status"]
          trip_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          delivered_at?: string | null
          id?: never
          is_simulated?: boolean
          purpose: string
          recipient_profile_id?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          trip_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          delivered_at?: string | null
          id?: never
          is_simulated?: boolean
          purpose?: string
          recipient_profile_id?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          full_name: string
          id: string
          locale: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          full_name: string
          id?: string
          locale?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          locale?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
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
      trip_events: {
        Row: {
          actor_profile_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["trip_event_type"]
          gate_id: string | null
          id: number
          occurred_at: string
          payload: Json
          reason: string | null
          source: string
          trip_id: string
        }
        Insert: {
          actor_profile_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["trip_event_type"]
          gate_id?: string | null
          id?: never
          occurred_at?: string
          payload?: Json
          reason?: string | null
          source?: string
          trip_id: string
        }
        Update: {
          actor_profile_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["trip_event_type"]
          gate_id?: string | null
          id?: never
          occurred_at?: string
          payload?: Json
          reason?: string | null
          source?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_events_gate_id_fkey"
            columns: ["gate_id"]
            isOneToOne: false
            referencedRelation: "gates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          appointment_end_at: string
          appointment_start_at: string
          cargo_type: string | null
          cargo_weight_kg: number | null
          company_id: string
          completed_at: string | null
          container_number: string | null
          created_at: string
          created_by: string
          crossed_at: string | null
          driver_profile_id: string
          gate_id: string | null
          id: string
          is_simulated: boolean
          operation_type: string
          planned_departure_at: string | null
          request_number: string
          status: Database["public"]["Enums"]["trip_status"]
          truck_id: string
          updated_at: string
        }
        Insert: {
          appointment_end_at: string
          appointment_start_at: string
          cargo_type?: string | null
          cargo_weight_kg?: number | null
          company_id: string
          completed_at?: string | null
          container_number?: string | null
          created_at?: string
          created_by: string
          crossed_at?: string | null
          driver_profile_id: string
          gate_id?: string | null
          id?: string
          is_simulated?: boolean
          operation_type: string
          planned_departure_at?: string | null
          request_number: string
          status?: Database["public"]["Enums"]["trip_status"]
          truck_id: string
          updated_at?: string
        }
        Update: {
          appointment_end_at?: string
          appointment_start_at?: string
          cargo_type?: string | null
          cargo_weight_kg?: number | null
          company_id?: string
          completed_at?: string | null
          container_number?: string | null
          created_at?: string
          created_by?: string
          crossed_at?: string | null
          driver_profile_id?: string
          gate_id?: string | null
          id?: string
          is_simulated?: boolean
          operation_type?: string
          planned_departure_at?: string | null
          request_number?: string
          status?: Database["public"]["Enums"]["trip_status"]
          truck_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_driver_profile_id_fkey"
            columns: ["driver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_gate_id_fkey"
            columns: ["gate_id"]
            isOneToOne: false
            referencedRelation: "gates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      trucks: {
        Row: {
          attributes: Json
          company_id: string
          created_at: string
          id: string
          plate_number: string
          updated_at: string
          vehicle_type: string | null
        }
        Insert: {
          attributes?: Json
          company_id: string
          created_at?: string
          id?: string
          plate_number: string
          updated_at?: string
          vehicle_type?: string | null
        }
        Update: {
          attributes?: Json
          company_id?: string
          created_at?: string
          id?: string
          plate_number?: string
          updated_at?: string
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trucks_company_id_fkey"
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
      [_ in never]: never
    }
    Enums: {
      app_role: "company_admin" | "driver" | "gate_operator" | "demo_admin"
      gate_status: "open" | "busy" | "closed" | "out_of_service"
      notification_status: "pending" | "delivered" | "failed"
      trip_event_type:
        | "trip_created"
        | "trip_started"
        | "arrival_reported"
        | "recommendation_accepted"
        | "verification_passed"
        | "verification_failed"
        | "barrier_open_requested"
        | "barrier_opened"
        | "barrier_failed"
        | "crossing_confirmed"
        | "exception_recorded"
      trip_status:
        | "planned"
        | "in_transit"
        | "at_gate"
        | "verification_failed"
        | "verified"
        | "barrier_failed"
        | "barrier_open"
        | "completed"
        | "exception"
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
      app_role: ["company_admin", "driver", "gate_operator", "demo_admin"],
      gate_status: ["open", "busy", "closed", "out_of_service"],
      notification_status: ["pending", "delivered", "failed"],
      trip_event_type: [
        "trip_created",
        "trip_started",
        "arrival_reported",
        "recommendation_accepted",
        "verification_passed",
        "verification_failed",
        "barrier_open_requested",
        "barrier_opened",
        "barrier_failed",
        "crossing_confirmed",
        "exception_recorded",
      ],
      trip_status: [
        "planned",
        "in_transit",
        "at_gate",
        "verification_failed",
        "verified",
        "barrier_failed",
        "barrier_open",
        "completed",
        "exception",
      ],
    },
  },
} as const

