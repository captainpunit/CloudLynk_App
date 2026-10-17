export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      app_installs: {
        Row: {
          created_at: string;
          id: string;
          install_referrer: string | null;
          meta_anon_id: string | null;
          meta_campaign_data: Json | null;
          platform: string;
          user_id: string | null;
          utm_campaign: string | null;
          utm_source: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          install_referrer?: string | null;
          meta_anon_id?: string | null;
          meta_campaign_data?: Json | null;
          platform?: string;
          user_id?: string | null;
          utm_campaign?: string | null;
          utm_source?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          install_referrer?: string | null;
          meta_anon_id?: string | null;
          meta_campaign_data?: Json | null;
          platform?: string;
          user_id?: string | null;
          utm_campaign?: string | null;
          utm_source?: string | null;
        };
        Relationships: [];
      };
      channel_members: {
        Row: {
          channel_id: string;
          joined_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          channel_id: string;
          joined_at?: string;
          user_id: string;
        };
        Update: {
          channel_id?: string;
          joined_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      channels: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          name: string;
          requires_subscription: boolean;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          requires_subscription?: boolean;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          requires_subscription?: boolean;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "channels_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      meta_event_outbox: {
        Row: {
          attempts: number;
          created_at: string;
          currency: string | null;
          event_id: string;
          event_name: string;
          id: string;
          last_error: string | null;
          payload: NonNullable<Json>;
          sent_at: string | null;
          status: string;
          user_id: string | null;
          value: number | null;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          created_at?: string;
          currency?: string | null;
          event_id: string;
          event_name: string;
          id?: string;
          last_error?: string | null;
          payload?: NonNullable<Json>;
          sent_at?: string | null;
          status?: string;
          user_id?: string | null;
          value?: number | null;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          currency?: string | null;
          event_id?: string;
          event_name?: string;
          id?: string;
          last_error?: string | null;
          payload?: NonNullable<Json>;
          sent_at?: string | null;
          status?: string;
          user_id?: string | null;
          value?: number | null;
        };
        Relationships: [];
      };
      payment_events: {
        Row: {
          created_at: string;
          id: string;
          notification_type: number | null;
          payload: NonNullable<Json>;
          processed_at: string | null;
          provider: string;
          provider_event_id: string;
          purchase_token: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          notification_type?: number | null;
          payload: NonNullable<Json>;
          processed_at?: string | null;
          provider?: string;
          provider_event_id: string;
          purchase_token?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          notification_type?: number | null;
          payload?: NonNullable<Json>;
          processed_at?: string | null;
          provider?: string;
          provider_event_id?: string;
          purchase_token?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          account_status: string;
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          role: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          account_status?: string;
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          role?: string;
          updated_at?: string;
        };
        Update: {
          account_status?: string;
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          role?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          created_at: string;
          id: string;
          is_trial: boolean;
          paid_until: string | null;
          product_id: string;
          provider: string;
          purchase_token: string;
          status: string;
          updated_at: string;
          user_id: string;
          verified_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          is_trial?: boolean;
          paid_until?: string | null;
          product_id: string;
          provider?: string;
          purchase_token: string;
          status: string;
          updated_at?: string;
          user_id: string;
          verified_at?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_trial?: boolean;
          paid_until?: string | null;
          product_id?: string;
          provider?: string;
          purchase_token?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
          verified_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      access_decision: {
        Args: { p_action: string; p_channel_id?: string; p_user_id: string };
        Returns: string;
      };
      has_active_subscription: { Args: { p_user_id: string }; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      join_channel: { Args: { p_channel_id: string }; Returns: undefined };
      leave_channel: { Args: { p_channel_id: string }; Returns: undefined };
      my_access: { Args: { p_action: string; p_channel_id?: string }; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
