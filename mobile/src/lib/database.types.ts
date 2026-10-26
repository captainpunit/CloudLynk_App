export type Json = string | number | boolean | null | {
  [key: string]: Json | undefined;
} | Json[];

export type Database = {
  "graphql_public": {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      "graphql": {
        Args: {
          "extensions"?: Json;
          "operationName"?: string;
          "query"?: string;
          "variables"?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  "public": {
    Tables: {
      "app_installs": {
        Row: {
          "created_at": string;
          "extinfo": Json | null;
          "id": string;
          "install_referrer": string | null;
          "installation_id": string | null;
          "meta_anon_id": string | null;
          "meta_campaign_data": Json | null;
          "platform": string;
          "tracking_consent": boolean;
          "updated_at": string;
          "user_id": string | null;
          "utm_campaign": string | null;
          "utm_source": string | null;
        };
        ComputedFields: never;
        Insert: {
          "created_at"?: string;
          "extinfo"?: Json | null;
          "id"?: string;
          "install_referrer"?: string | null;
          "installation_id"?: string | null;
          "meta_anon_id"?: string | null;
          "meta_campaign_data"?: Json | null;
          "platform"?: string;
          "tracking_consent"?: boolean;
          "updated_at"?: string;
          "user_id"?: string | null;
          "utm_campaign"?: string | null;
          "utm_source"?: string | null;
        };
        Update: {
          "created_at"?: string;
          "extinfo"?: Json | null;
          "id"?: string;
          "install_referrer"?: string | null;
          "installation_id"?: string | null;
          "meta_anon_id"?: string | null;
          "meta_campaign_data"?: Json | null;
          "platform"?: string;
          "tracking_consent"?: boolean;
          "updated_at"?: string;
          "user_id"?: string | null;
          "utm_campaign"?: string | null;
          "utm_source"?: string | null;
        };
        Relationships: [];
      };
      "channel_members": {
        Row: {
          "channel_id": string;
          "joined_at": string;
          "user_id": string;
        };
        ComputedFields: never;
        Insert: {
          "channel_id": string;
          "joined_at"?: string;
          "user_id": string;
        };
        Update: {
          "channel_id"?: string;
          "joined_at"?: string;
          "user_id"?: string;
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
      "channels": {
        Row: {
          "created_at": string;
          "created_by": string | null;
          "description": string | null;
          "id": string;
          "name": string;
          "requires_subscription": boolean;
          "status": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "created_at"?: string;
          "created_by"?: string | null;
          "description"?: string | null;
          "id"?: string;
          "name": string;
          "requires_subscription"?: boolean;
          "status"?: string;
          "updated_at"?: string;
        };
        Update: {
          "created_at"?: string;
          "created_by"?: string | null;
          "description"?: string | null;
          "id"?: string;
          "name"?: string;
          "requires_subscription"?: boolean;
          "status"?: string;
          "updated_at"?: string;
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
      "drive_settings": {
        Row: {
          "free_quota_bytes": number;
          "id": boolean;
          "max_pending_uploads": number;
          "subscriber_quota_bytes": number;
          "updated_at": string;
          "upload_window": string;
        };
        ComputedFields: never;
        Insert: {
          "free_quota_bytes": number;
          "id"?: boolean;
          "max_pending_uploads": number;
          "subscriber_quota_bytes": number;
          "updated_at"?: string;
          "upload_window": string;
        };
        Update: {
          "free_quota_bytes"?: number;
          "id"?: boolean;
          "max_pending_uploads"?: number;
          "subscriber_quota_bytes"?: number;
          "updated_at"?: string;
          "upload_window"?: string;
        };
        Relationships: [];
      };
      "files": {
        Row: {
          "category": string;
          "created_at": string;
          "expires_at": string | null;
          "id": string;
          "mime_type": string;
          "name": string;
          "owner_id": string;
          "size_bytes": number;
          "status": string;
          "storage_path": string;
          "updated_at": string;
          "uploaded_at": string | null;
        };
        ComputedFields: never;
        Insert: {
          "category": string;
          "created_at"?: string;
          "expires_at"?: string | null;
          "id"?: string;
          "mime_type": string;
          "name": string;
          "owner_id": string;
          "size_bytes": number;
          "status"?: string;
          "storage_path": string;
          "updated_at"?: string;
          "uploaded_at"?: string | null;
        };
        Update: {
          "category"?: string;
          "created_at"?: string;
          "expires_at"?: string | null;
          "id"?: string;
          "mime_type"?: string;
          "name"?: string;
          "owner_id"?: string;
          "size_bytes"?: number;
          "status"?: string;
          "storage_path"?: string;
          "updated_at"?: string;
          "uploaded_at"?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "files_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "meta_event_outbox": {
        Row: {
          "attempts": number;
          "created_at": string;
          "currency": string | null;
          "event_id": string;
          "event_name": string;
          "id": string;
          "last_error": string | null;
          "lease_id": string | null;
          "lease_until": string | null;
          "next_attempt_at": string;
          "payload": NonNullable<Json>;
          "sent_at": string | null;
          "status": string;
          "user_id": string | null;
          "value": number | null;
        };
        ComputedFields: never;
        Insert: {
          "attempts"?: number;
          "created_at"?: string;
          "currency"?: string | null;
          "event_id": string;
          "event_name": string;
          "id"?: string;
          "last_error"?: string | null;
          "lease_id"?: string | null;
          "lease_until"?: string | null;
          "next_attempt_at"?: string;
          "payload"?: NonNullable<Json>;
          "sent_at"?: string | null;
          "status"?: string;
          "user_id"?: string | null;
          "value"?: number | null;
        };
        Update: {
          "attempts"?: number;
          "created_at"?: string;
          "currency"?: string | null;
          "event_id"?: string;
          "event_name"?: string;
          "id"?: string;
          "last_error"?: string | null;
          "lease_id"?: string | null;
          "lease_until"?: string | null;
          "next_attempt_at"?: string;
          "payload"?: NonNullable<Json>;
          "sent_at"?: string | null;
          "status"?: string;
          "user_id"?: string | null;
          "value"?: number | null;
        };
        Relationships: [];
      };
      "payment_events": {
        Row: {
          "created_at": string;
          "id": string;
          "notification_type": number | null;
          "payload": NonNullable<Json>;
          "processed_at": string | null;
          "provider": string;
          "provider_event_id": string;
          "purchase_token": string | null;
        };
        ComputedFields: never;
        Insert: {
          "created_at"?: string;
          "id"?: string;
          "notification_type"?: number | null;
          "payload": NonNullable<Json>;
          "processed_at"?: string | null;
          "provider"?: string;
          "provider_event_id": string;
          "purchase_token"?: string | null;
        };
        Update: {
          "created_at"?: string;
          "id"?: string;
          "notification_type"?: number | null;
          "payload"?: NonNullable<Json>;
          "processed_at"?: string | null;
          "provider"?: string;
          "provider_event_id"?: string;
          "purchase_token"?: string | null;
        };
        Relationships: [];
      };
      "plans": {
        Row: {
          "active": boolean;
          "benefits": (string)[];
          "billing_period": string;
          "created_at": string;
          "name": string;
          "product_id": string;
          "quota_bytes": number;
        };
        ComputedFields: never;
        Insert: {
          "active"?: boolean;
          "benefits"?: (string)[];
          "billing_period": string;
          "created_at"?: string;
          "name": string;
          "product_id": string;
          "quota_bytes": number;
        };
        Update: {
          "active"?: boolean;
          "benefits"?: (string)[];
          "billing_period"?: string;
          "created_at"?: string;
          "name"?: string;
          "product_id"?: string;
          "quota_bytes"?: number;
        };
        Relationships: [];
      };
      "profiles": {
        Row: {
          "account_status": string;
          "avatar_url": string | null;
          "created_at": string;
          "display_name": string | null;
          "id": string;
          "play_account_id": string | null;
          "role": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "account_status"?: string;
          "avatar_url"?: string | null;
          "created_at"?: string;
          "display_name"?: string | null;
          "id": string;
          "play_account_id"?: never;
          "role"?: string;
          "updated_at"?: string;
        };
        Update: {
          "account_status"?: string;
          "avatar_url"?: string | null;
          "created_at"?: string;
          "display_name"?: string | null;
          "id"?: string;
          "play_account_id"?: never;
          "role"?: string;
          "updated_at"?: string;
        };
        Relationships: [];
      };
      "subscription_sync_locks": {
        Row: {
          "expires_at": string;
          "lease_id": string;
          "purchase_token": string;
        };
        ComputedFields: never;
        Insert: {
          "expires_at": string;
          "lease_id": string;
          "purchase_token": string;
        };
        Update: {
          "expires_at"?: string;
          "lease_id"?: string;
          "purchase_token"?: string;
        };
        Relationships: [];
      };
      "subscriptions": {
        Row: {
          "created_at": string;
          "id": string;
          "is_trial": boolean;
          "latest_order_id": string | null;
          "next_check_at": string;
          "paid_until": string | null;
          "product_id": string;
          "provider": string;
          "purchase_token": string;
          "status": string;
          "superseded_by": string | null;
          "sync_error": string | null;
          "updated_at": string;
          "user_id": string;
          "verified_at": string | null;
        };
        ComputedFields: never;
        Insert: {
          "created_at"?: string;
          "id"?: string;
          "is_trial"?: boolean;
          "latest_order_id"?: string | null;
          "next_check_at"?: string;
          "paid_until"?: string | null;
          "product_id": string;
          "provider"?: string;
          "purchase_token": string;
          "status": string;
          "superseded_by"?: string | null;
          "sync_error"?: string | null;
          "updated_at"?: string;
          "user_id": string;
          "verified_at"?: string | null;
        };
        Update: {
          "created_at"?: string;
          "id"?: string;
          "is_trial"?: boolean;
          "latest_order_id"?: string | null;
          "next_check_at"?: string;
          "paid_until"?: string | null;
          "product_id"?: string;
          "provider"?: string;
          "purchase_token"?: string;
          "status"?: string;
          "superseded_by"?: string | null;
          "sync_error"?: string | null;
          "updated_at"?: string;
          "user_id"?: string;
          "verified_at"?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      "access_decision": {
        Args: {
          "p_action": string;
          "p_channel_id"?: string;
          "p_user_id": string;
        };
        Returns: string;
      };
      "apply_play_snapshot": {
        Args: {
          "p_event"?: Json;
          "p_lease": string;
          "p_snapshot": Json;
          "p_token": string;
          "p_user_id": string;
        };
        Returns: {
          "created_at": string;
          "id": string;
          "is_trial": boolean;
          "latest_order_id": string | null;
          "next_check_at": string;
          "paid_until": string | null;
          "product_id": string;
          "provider": string;
          "purchase_token": string;
          "status": string;
          "superseded_by": string | null;
          "sync_error": string | null;
          "updated_at": string;
          "user_id": string;
          "verified_at": string | null;
        };
        SetofOptions: {
          from: "*";
          to: "subscriptions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "claim_meta_events": {
        Args: { "p_limit"?: number };
        Returns: {
          "attempts": number;
          "created_at": string;
          "currency": string | null;
          "event_id": string;
          "event_name": string;
          "id": string;
          "last_error": string | null;
          "lease_id": string | null;
          "lease_until": string | null;
          "next_attempt_at": string;
          "payload": NonNullable<Json>;
          "sent_at": string | null;
          "status": string;
          "user_id": string | null;
          "value": number | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "meta_event_outbox";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      "claim_subscription_sync": {
        Args: { "p_token": string };
        Returns: string;
      };
      "delete_drive_file": {
        Args: { "p_file_id": string };
        Returns: undefined;
      };
      "drive_can_read_object": { Args: { "p_name": string }; Returns: boolean };
      "drive_can_write_object": {
        Args: { "p_name": string };
        Returns: boolean;
      };
      "drive_category": { Args: { "p_mime_type": string }; Returns: string };
      "drive_cleanup_batch": {
        Args: { "p_limit"?: number };
        Returns: {
          "file_id": string;
          "storage_path": string;
        }[];
      };
      "drive_cleanup_finish": {
        Args: { "p_file_ids": (string)[] };
        Returns: number;
      };
      "drive_max_file_bytes": {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      "drive_quota_bytes": { Args: { "p_user_id": string }; Returns: number };
      "drive_usage": {
        Args: { "p_user_id": string };
        Returns: Record<string, unknown>;
      };
      "finalize_drive_upload": {
        Args: { "p_file_id": string };
        Returns: {
          "category": string;
          "created_at": string;
          "expires_at": string | null;
          "id": string;
          "mime_type": string;
          "name": string;
          "owner_id": string;
          "size_bytes": number;
          "status": string;
          "storage_path": string;
          "updated_at": string;
          "uploaded_at": string | null;
        };
        SetofOptions: {
          from: "*";
          to: "files";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "finish_meta_event": {
        Args: { "p_error"?: string; "p_id": string; "p_lease": string };
        Returns: undefined;
      };
      "has_active_subscription": {
        Args: { "p_user_id": string };
        Returns: boolean;
      };
      "is_admin": { Args: Record<PropertyKey, never>; Returns: boolean };
      "join_channel": { Args: { "p_channel_id": string }; Returns: undefined };
      "leave_channel": { Args: { "p_channel_id": string }; Returns: undefined };
      "my_access": {
        Args: { "p_action": string; "p_channel_id"?: string };
        Returns: string;
      };
      "my_drive_usage": {
        Args: Record<PropertyKey, never>;
        Returns: {
          "can_upload": boolean;
          "max_file_bytes": number;
          "quota_bytes": number;
          "reserved_bytes": number;
          "used_bytes": number;
        }[];
      };
      "release_subscription_sync": {
        Args: { "p_lease": string; "p_token": string };
        Returns: undefined;
      };
      "reserve_drive_upload": {
        Args: {
          "p_mime_type": string;
          "p_name": string;
          "p_size_bytes": number;
        };
        Returns: {
          "bucket": string;
          "expires_at": string;
          "file_id": string;
          "storage_path": string;
        }[];
      };
      "resolve_play_owner": {
        Args: { "p_account_id": string; "p_linked_token": string };
        Returns: string;
      };
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

type DefaultSchema =
  DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof (
      & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
        "Tables"
      ]
      & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
        "Views"
      ]
    )
    : never = never,
> = DefaultSchemaTableNameOrOptions extends
  { schema: keyof DatabaseWithoutInternals } ? (
    & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Views"
    ]
  )[TableName] extends {
    Row: infer R;
  } ? R
  : never
  : DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[
      DefaultSchemaTableNameOrOptions
    ] extends {
      Row: infer R;
    } ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends
  { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
    "Tables"
  ][TableName] extends {
    Insert: infer I;
  } ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    } ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends
  { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
    "Tables"
  ][TableName] extends {
    Update: infer U;
  } ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    } ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]][
      "Enums"
    ]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends
  { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][
    EnumName
  ]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[
      PublicCompositeTypeNameOrOptions["schema"]
    ]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends
  { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]][
    "CompositeTypes"
  ][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  "graphql_public": {
    Enums: {},
  },
  "public": {
    Enums: {},
  },
} as const;
