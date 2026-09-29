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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          trip_id: string
        }
        Insert: {
          action: string
          actor_user_id: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          trip_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          color: string
          created_at: string
          estimated_amount_paise: number
          id: string
          name: string
          trip_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          estimated_amount_paise?: number
          id?: string
          name: string
          trip_id: string
        }
        Update: {
          color?: string
          created_at?: string
          estimated_amount_paise?: number
          id?: string
          name?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_splits: {
        Row: {
          amount_paise: number
          created_at: string
          expense_id: string
          id: string
          member_id: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          expense_id: string
          id?: string
          member_id: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          expense_id?: string
          id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_splits_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_splits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "trip_members"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount_paise: number
          category_id: string | null
          created_at: string
          created_by: string
          expense_date: string
          id: string
          idempotency_key: string
          is_paid: boolean
          note: string | null
          paid_by_member_id: string | null
          payment_source: string
          receipt_url: string | null
          split_method: string
          status: string
          title: string
          trip_id: string
          updated_at: string
          version: number
        }
        Insert: {
          amount_paise: number
          category_id?: string | null
          created_at?: string
          created_by: string
          expense_date: string
          id?: string
          idempotency_key: string
          is_paid?: boolean
          note?: string | null
          paid_by_member_id?: string | null
          payment_source: string
          receipt_url?: string | null
          split_method: string
          status?: string
          title: string
          trip_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          amount_paise?: number
          category_id?: string | null
          created_at?: string
          created_by?: string
          expense_date?: string
          id?: string
          idempotency_key?: string
          is_paid?: boolean
          note?: string | null
          paid_by_member_id?: string | null
          payment_source?: string
          receipt_url?: string | null
          split_method?: string
          status?: string
          title?: string
          trip_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_member_id_fkey"
            columns: ["paid_by_member_id"]
            isOneToOne: false
            referencedRelation: "trip_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_member_groups: {
        Row: {
          created_at: string
          id: string
          member_ids: string[]
          name: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_ids?: string[]
          name: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_ids?: string[]
          name?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_member_groups_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      fund_transactions: {
        Row: {
          amount_paise: number
          created_at: string
          created_by: string
          id: string
          idempotency_key: string
          member_id: string
          note: string | null
          occurred_at: string
          status: string
          transaction_type: string
          trip_id: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          created_by: string
          id?: string
          idempotency_key: string
          member_id: string
          note?: string | null
          occurred_at?: string
          status?: string
          transaction_type: string
          trip_id: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          created_by?: string
          id?: string
          idempotency_key?: string
          member_id?: string
          note?: string | null
          occurred_at?: string
          status?: string
          transaction_type?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fund_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "trip_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_transactions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_admins: {
        Row: {
          created_at: string
          trip_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          trip_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_admins_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          created_at: string
          id: string
          name: string
          note: string | null
          status: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          note?: string | null
          status?: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          status?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          created_at: string
          currency: string
          end_date: string | null
          id: string
          name: string
          note: string | null
          owner_id: string
          share_enabled: boolean
          share_pin: string | null
          share_token: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          end_date?: string | null
          id?: string
          name: string
          note?: string | null
          owner_id: string
          share_enabled?: boolean
          share_pin?: string | null
          share_token?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          end_date?: string | null
          id?: string
          name?: string
          note?: string | null
          owner_id?: string
          share_enabled?: boolean
          share_pin?: string | null
          share_token?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_funds: {
        Args: {
          p_amount_paise: number
          p_idempotency_key: string
          p_member_id: string
          p_note: string
          p_trip_id: string
        }
        Returns: string
      }
      add_trip_admin_by_email: {
        Args: { p_email: string; p_trip_id: string }
        Returns: string
      }
      check_trip_pin_required: {
        Args: { p_share_token: string }
        Returns: boolean
      }
      create_expense:
        | {
            Args: {
              p_amount_paise: number
              p_expense_date: string
              p_idempotency_key: string
              p_note: string
              p_paid_by_member_id: string
              p_payment_source: string
              p_split_method: string
              p_splits: Json
              p_title: string
              p_trip_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_amount_paise: number
              p_expense_date: string
              p_idempotency_key: string
              p_note: string
              p_paid_by_member_id: string
              p_payment_source: string
              p_receipt_url?: string
              p_split_method: string
              p_splits: Json
              p_title: string
              p_trip_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_amount_paise: number
              p_category_id?: string
              p_expense_date: string
              p_idempotency_key: string
              p_is_paid?: boolean
              p_note: string
              p_paid_by_member_id: string
              p_payment_source: string
              p_receipt_url?: string
              p_split_method: string
              p_splits: Json
              p_title: string
              p_trip_id: string
            }
            Returns: string
          }
      get_share_pin: { Args: never; Returns: string }
      get_share_token: { Args: never; Returns: string }
      get_trip_admins: {
        Args: { p_trip_id: string }
        Returns: {
          created_at: string
          email: string
          user_id: string
        }[]
      }
      get_trip_owner: {
        Args: { p_trip_id: string }
        Returns: {
          email: string
          owner_id: string
        }[]
      }
      is_trip_admin: { Args: { p_trip_id: string }; Returns: boolean }
      remove_funds: {
        Args: {
          p_amount_paise: number
          p_idempotency_key: string
          p_member_id: string
          p_note: string
          p_trip_id: string
        }
        Returns: string
      }
      update_expense:
        | {
            Args: {
              p_amount_paise: number
              p_expense_date: string
              p_expense_id: string
              p_note: string
              p_paid_by_member_id: string
              p_payment_source: string
              p_split_method: string
              p_splits: Json
              p_title: string
            }
            Returns: string
          }
        | {
            Args: {
              p_amount_paise: number
              p_expense_date: string
              p_expense_id: string
              p_note: string
              p_paid_by_member_id: string
              p_payment_source: string
              p_receipt_url?: string
              p_split_method: string
              p_splits: Json
              p_title: string
            }
            Returns: string
          }
        | {
            Args: {
              p_amount_paise: number
              p_category_id?: string
              p_expense_date: string
              p_expense_id: string
              p_is_paid?: boolean
              p_note: string
              p_paid_by_member_id: string
              p_payment_source: string
              p_receipt_url?: string
              p_split_method: string
              p_splits: Json
              p_title: string
            }
            Returns: string
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
