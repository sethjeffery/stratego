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
      game_sessions: {
        Row: {
          created_at: string
          session_id: string
          state: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          session_id: string
          state?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          session_id?: string
          state?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      player_profiles: {
        Row: {
          avatar_id: string
          created_at: string
          device_id: string
          player_name: string
          updated_at: string
        }
        Insert: {
          avatar_id?: string
          created_at?: string
          device_id: string
          player_name: string
          updated_at?: string
        }
        Update: {
          avatar_id?: string
          created_at?: string
          device_id?: string
          player_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_chat_messages: {
        Row: {
          created_at: string
          id: string
          player_id: string
          sender_name: string
          sent_at: string
          session_id: string
          text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          player_id: string
          sender_name: string
          sent_at?: string
          session_id: string
          text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          player_id?: string
          sender_name?: string
          sent_at?: string
          session_id?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "open_game_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "unarchived_game_sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
      session_memberships: {
        Row: {
          archived_at: string | null
          created_at: string
          device_id: string
          last_opened_at: string
          role: Database["public"]["Enums"]["session_role"]
          session_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          device_id: string
          last_opened_at?: string
          role: Database["public"]["Enums"]["session_role"]
          session_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          device_id?: string
          last_opened_at?: string
          role?: Database["public"]["Enums"]["session_role"]
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_memberships_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "player_profiles"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "session_memberships_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_memberships_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "open_game_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_memberships_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "unarchived_game_sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
    }
    Views: {
      open_game_sessions: {
        Row: {
          created_at: string | null
          session_id: string | null
          state: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          session_id?: string | null
          state?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          session_id?: string | null
          state?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      unarchived_game_sessions: {
        Row: {
          created_at: string | null
          session_id: string | null
          state: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          session_id?: string | null
          state?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          session_id?: string | null
          state?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      session_role: "initiator" | "challenger"
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
      session_role: ["initiator", "challenger"],
    },
  },
} as const
