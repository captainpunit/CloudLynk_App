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
      "account_deletion_requests": {
        Row: {
          "attempts": number;
          "completed_at": string | null;
          "created_at": string;
          "id": string;
          "last_error": string | null;
          "lease_id": string | null;
          "lease_until": string | null;
          "next_attempt_at": string;
          "state": string;
          "user_id": string | null;
        };
        ComputedFields: never;
        Insert: {
          "attempts"?: number;
          "completed_at"?: string | null;
          "created_at"?: string;
          "id"?: string;
          "last_error"?: string | null;
          "lease_id"?: string | null;
          "lease_until"?: string | null;
          "next_attempt_at"?: string;
          "state"?: string;
          "user_id"?: string | null;
        };
        Update: {
          "attempts"?: number;
          "completed_at"?: string | null;
          "created_at"?: string;
          "id"?: string;
          "last_error"?: string | null;
          "lease_id"?: string | null;
          "lease_until"?: string | null;
          "next_attempt_at"?: string;
          "state"?: string;
          "user_id"?: string | null;
        };
        Relationships: [];
      };
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
      "audit_log": {
        Row: {
          "action": string;
          "actor_id": string | null;
          "created_at": string;
          "details": NonNullable<Json>;
          "id": number;
          "reason": string | null;
          "target_id": string | null;
          "target_kind": string;
        };
        ComputedFields: never;
        Insert: {
          "action": string;
          "actor_id"?: string | null;
          "created_at"?: string;
          "details"?: NonNullable<Json>;
          "id"?: never;
          "reason"?: string | null;
          "target_id"?: string | null;
          "target_kind": string;
        };
        Update: {
          "action"?: string;
          "actor_id"?: string | null;
          "created_at"?: string;
          "details"?: NonNullable<Json>;
          "id"?: never;
          "reason"?: string | null;
          "target_id"?: string | null;
          "target_kind"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "channel_invitations": {
        Row: {
          "channel_id": string;
          "created_at": string;
          "invited_by": string | null;
          "user_id": string;
        };
        ComputedFields: never;
        Insert: {
          "channel_id": string;
          "created_at"?: string;
          "invited_by"?: string | null;
          "user_id": string;
        };
        Update: {
          "channel_id"?: string;
          "created_at"?: string;
          "invited_by"?: string | null;
          "user_id"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "channel_invitations_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_invitations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
          "category": string;
          "cover_url": string | null;
          "created_at": string;
          "created_by": string | null;
          "description": string | null;
          "id": string;
          "is_private": boolean;
          "name": string;
          "requires_subscription": boolean;
          "status": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "category"?: string;
          "cover_url"?: string | null;
          "created_at"?: string;
          "created_by"?: string | null;
          "description"?: string | null;
          "id"?: string;
          "is_private"?: boolean;
          "name": string;
          "requires_subscription"?: boolean;
          "status"?: string;
          "updated_at"?: string;
        };
        Update: {
          "category"?: string;
          "cover_url"?: string | null;
          "created_at"?: string;
          "created_by"?: string | null;
          "description"?: string | null;
          "id"?: string;
          "is_private"?: boolean;
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
      "content_reports": {
        Row: {
          "created_at": string;
          "details": string;
          "id": string;
          "reason": string;
          "reporter_id": string | null;
          "resolved_at": string | null;
          "status": string;
          "title_id": string | null;
        };
        ComputedFields: never;
        Insert: {
          "created_at"?: string;
          "details"?: string;
          "id"?: string;
          "reason": string;
          "reporter_id"?: string | null;
          "resolved_at"?: string | null;
          "status"?: string;
          "title_id"?: string | null;
        };
        Update: {
          "created_at"?: string;
          "details"?: string;
          "id"?: string;
          "reason"?: string;
          "reporter_id"?: string | null;
          "resolved_at"?: string | null;
          "status"?: string;
          "title_id"?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "content_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_reports_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
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
      "erased_purchase_tokens": {
        Row: {
          "expires_at": string;
          "token_hash": string;
        };
        ComputedFields: never;
        Insert: {
          "expires_at"?: string;
          "token_hash": string;
        };
        Update: {
          "expires_at"?: string;
          "token_hash"?: string;
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
      "job_runs": {
        Row: {
          "finished_at": string | null;
          "id": string;
          "job_name": string;
          "started_at": string;
          "status": string;
          "summary": NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          "finished_at"?: string | null;
          "id"?: string;
          "job_name": string;
          "started_at"?: string;
          "status"?: string;
          "summary"?: NonNullable<Json>;
        };
        Update: {
          "finished_at"?: string | null;
          "id"?: string;
          "job_name"?: string;
          "started_at"?: string;
          "status"?: string;
          "summary"?: NonNullable<Json>;
        };
        Relationships: [];
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
      "notices": {
        Row: {
          "body": string;
          "campaign_id": string;
          "created_at": string;
          "data": NonNullable<Json>;
          "id": string;
          "read_at": string | null;
          "title": string;
          "user_id": string;
        };
        ComputedFields: never;
        Insert: {
          "body": string;
          "campaign_id": string;
          "created_at"?: string;
          "data"?: NonNullable<Json>;
          "id"?: string;
          "read_at"?: string | null;
          "title": string;
          "user_id": string;
        };
        Update: {
          "body"?: string;
          "campaign_id"?: string;
          "created_at"?: string;
          "data"?: NonNullable<Json>;
          "id"?: string;
          "read_at"?: string | null;
          "title"?: string;
          "user_id"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notices_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
          "birth_date": string | null;
          "can_publish": boolean;
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
          "birth_date"?: string | null;
          "can_publish"?: boolean;
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
          "birth_date"?: string | null;
          "can_publish"?: boolean;
          "created_at"?: string;
          "display_name"?: string | null;
          "id"?: string;
          "play_account_id"?: never;
          "role"?: string;
          "updated_at"?: string;
        };
        Relationships: [];
      };
      "push_deliveries": {
        Row: {
          "attempts": number;
          "id": string;
          "last_error": string | null;
          "lease_id": string | null;
          "lease_until": string | null;
          "next_attempt_at": string;
          "notice_id": string;
          "state": string;
          "submitted_at": string | null;
          "ticket_id": string | null;
          "token_id": string;
        };
        ComputedFields: never;
        Insert: {
          "attempts"?: number;
          "id"?: string;
          "last_error"?: string | null;
          "lease_id"?: string | null;
          "lease_until"?: string | null;
          "next_attempt_at"?: string;
          "notice_id": string;
          "state"?: string;
          "submitted_at"?: string | null;
          "ticket_id"?: string | null;
          "token_id": string;
        };
        Update: {
          "attempts"?: number;
          "id"?: string;
          "last_error"?: string | null;
          "lease_id"?: string | null;
          "lease_until"?: string | null;
          "next_attempt_at"?: string;
          "notice_id"?: string;
          "state"?: string;
          "submitted_at"?: string | null;
          "ticket_id"?: string | null;
          "token_id"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_deliveries_notice_id_fkey";
            columns: ["notice_id"];
            isOneToOne: false;
            referencedRelation: "notices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "push_deliveries_token_id_fkey";
            columns: ["token_id"];
            isOneToOne: false;
            referencedRelation: "push_tokens";
            referencedColumns: ["id"];
          },
        ];
      };
      "push_tokens": {
        Row: {
          "enabled": boolean;
          "id": string;
          "installation_id": string;
          "token": string;
          "updated_at": string;
          "user_id": string;
        };
        ComputedFields: never;
        Insert: {
          "enabled"?: boolean;
          "id"?: string;
          "installation_id": string;
          "token": string;
          "updated_at"?: string;
          "user_id": string;
        };
        Update: {
          "enabled"?: boolean;
          "id"?: string;
          "installation_id"?: string;
          "token"?: string;
          "updated_at"?: string;
          "user_id"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "saved_titles": {
        Row: {
          "created_at": string;
          "title_id": string;
          "user_id": string;
        };
        ComputedFields: never;
        Insert: {
          "created_at"?: string;
          "title_id": string;
          "user_id": string;
        };
        Update: {
          "created_at"?: string;
          "title_id"?: string;
          "user_id"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_titles_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_titles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      "seasons": {
        Row: {
          "created_at": string;
          "id": string;
          "name": string;
          "number": number;
          "series_id": string;
        };
        ComputedFields: never;
        Insert: {
          "created_at"?: string;
          "id"?: string;
          "name": string;
          "number": number;
          "series_id": string;
        };
        Update: {
          "created_at"?: string;
          "id"?: string;
          "name"?: string;
          "number"?: number;
          "series_id"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seasons_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      "stream_allocation_intents": {
        Row: {
          "asset_id": string;
          "created_at": string;
          "id": string;
          "next_check_at": string;
          "owner_id": string;
        };
        ComputedFields: never;
        Insert: {
          "asset_id": string;
          "created_at"?: string;
          "id": string;
          "next_check_at"?: string;
          "owner_id": string;
        };
        Update: {
          "asset_id"?: string;
          "created_at"?: string;
          "id"?: string;
          "next_check_at"?: string;
          "owner_id"?: string;
        };
        Relationships: [];
      };
      "stream_assets": {
        Row: {
          "created_at": string;
          "duration_seconds": number | null;
          "error_code": string | null;
          "id": string;
          "lease_id": string | null;
          "lease_until": string | null;
          "next_check_at": string;
          "owner_id": string;
          "signed_only": boolean;
          "state": string;
          "stream_uid": string | null;
          "title_id": string;
          "updated_at": string;
          "upload_expires_at": string | null;
          "upload_url": string | null;
        };
        ComputedFields: never;
        Insert: {
          "created_at"?: string;
          "duration_seconds"?: number | null;
          "error_code"?: string | null;
          "id"?: string;
          "lease_id"?: string | null;
          "lease_until"?: string | null;
          "next_check_at"?: string;
          "owner_id": string;
          "signed_only"?: boolean;
          "state"?: string;
          "stream_uid"?: string | null;
          "title_id": string;
          "updated_at"?: string;
          "upload_expires_at"?: string | null;
          "upload_url"?: string | null;
        };
        Update: {
          "created_at"?: string;
          "duration_seconds"?: number | null;
          "error_code"?: string | null;
          "id"?: string;
          "lease_id"?: string | null;
          "lease_until"?: string | null;
          "next_check_at"?: string;
          "owner_id"?: string;
          "signed_only"?: boolean;
          "state"?: string;
          "stream_uid"?: string | null;
          "title_id"?: string;
          "updated_at"?: string;
          "upload_expires_at"?: string | null;
          "upload_url"?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stream_assets_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: true;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      "stream_deletion_queue": {
        Row: {
          "attempts": number;
          "created_at": string;
          "last_error": string | null;
          "lease_id": string | null;
          "lease_until": string | null;
          "next_attempt_at": string;
          "owner_id": string | null;
          "state": string;
          "stream_uid": string;
        };
        ComputedFields: never;
        Insert: {
          "attempts"?: number;
          "created_at"?: string;
          "last_error"?: string | null;
          "lease_id"?: string | null;
          "lease_until"?: string | null;
          "next_attempt_at"?: string;
          "owner_id"?: string | null;
          "state"?: string;
          "stream_uid": string;
        };
        Update: {
          "attempts"?: number;
          "created_at"?: string;
          "last_error"?: string | null;
          "lease_id"?: string | null;
          "lease_until"?: string | null;
          "next_attempt_at"?: string;
          "owner_id"?: string | null;
          "state"?: string;
          "stream_uid"?: string;
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
      "titles": {
        Row: {
          "allowed_countries": (string)[];
          "channel_id": string;
          "cover_url": string | null;
          "created_at": string;
          "description": string;
          "episode_number": number | null;
          "id": string;
          "kind": string;
          "min_age": number;
          "name": string;
          "owner_id": string;
          "published_at": string | null;
          "season_id": string | null;
          "status": string;
          "updated_at": string;
        };
        ComputedFields: never;
        Insert: {
          "allowed_countries"?: (string)[];
          "channel_id": string;
          "cover_url"?: string | null;
          "created_at"?: string;
          "description"?: string;
          "episode_number"?: number | null;
          "id"?: string;
          "kind": string;
          "min_age": number;
          "name": string;
          "owner_id": string;
          "published_at"?: string | null;
          "season_id"?: string | null;
          "status"?: string;
          "updated_at"?: string;
        };
        Update: {
          "allowed_countries"?: (string)[];
          "channel_id"?: string;
          "cover_url"?: string | null;
          "created_at"?: string;
          "description"?: string;
          "episode_number"?: number | null;
          "id"?: string;
          "kind"?: string;
          "min_age"?: number;
          "name"?: string;
          "owner_id"?: string;
          "published_at"?: string | null;
          "season_id"?: string | null;
          "status"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "titles_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "titles_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "titles_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      "watch_progress": {
        Row: {
          "completed": boolean;
          "position_seconds": number;
          "title_id": string;
          "updated_at": string;
          "user_id": string;
        };
        ComputedFields: never;
        Insert: {
          "completed"?: boolean;
          "position_seconds": number;
          "title_id": string;
          "updated_at"?: string;
          "user_id": string;
        };
        Update: {
          "completed"?: boolean;
          "position_seconds"?: number;
          "title_id"?: string;
          "updated_at"?: string;
          "user_id"?: string;
        };
        Relationships: [
          {
            foreignKeyName: "watch_progress_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "watch_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      "my_stream_uploads": {
        Row: {
          "duration_seconds": number | null;
          "error_code": string | null;
          "id": string;
          "state": string;
          "title_id": string;
          "updated_at": string;
          "upload_expires_at": string | null;
        };
        ComputedFields: never;
        Insert: {
          "duration_seconds"?: number | null;
          "error_code"?: string | null;
          "id"?: string | null;
          "state"?: string | null;
          "title_id"?: string | null;
          "updated_at"?: string | null;
          "upload_expires_at"?: string | null;
        };
        Update: {
          "duration_seconds"?: number | null;
          "error_code"?: string | null;
          "id"?: string | null;
          "state"?: string | null;
          "title_id"?: string | null;
          "updated_at"?: string | null;
          "upload_expires_at"?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stream_assets_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: true;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
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
      "account_erasure_objects": {
        Args: {
          "p_lease": string;
          "p_limit"?: number;
          "p_request_id": string;
          "p_user_id": string;
        };
        Returns: {
          "bucket_id": string;
          "name": string;
        }[];
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
      "apply_stream_state": {
        Args: {
          "p_duration": number;
          "p_error"?: string;
          "p_signed": boolean;
          "p_state": string;
          "p_uid": string;
        };
        Returns: undefined;
      };
      "backend_health": { Args: Record<PropertyKey, never>; Returns: Json };
      "backend_health_base": {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      "bind_stream_upload": {
        Args: {
          "p_asset_id": string;
          "p_expires_at": string;
          "p_lease": string;
          "p_uid": string;
          "p_upload_url": string;
        };
        Returns: undefined;
      };
      "can_read_channel": {
        Args: { "p_channel_id": string };
        Returns: boolean;
      };
      "can_read_season": { Args: { "p_season_id": string }; Returns: boolean };
      "can_read_title": { Args: { "p_title_id": string }; Returns: boolean };
      "claim_account_deletions": {
        Args: { "p_limit"?: number };
        Returns: {
          "attempts": number;
          "completed_at": string | null;
          "created_at": string;
          "id": string;
          "last_error": string | null;
          "lease_id": string | null;
          "lease_until": string | null;
          "next_attempt_at": string;
          "state": string;
          "user_id": string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "account_deletion_requests";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      "claim_media_deletions": {
        Args: { "p_limit"?: number };
        Returns: {
          "attempts": number;
          "created_at": string;
          "last_error": string | null;
          "lease_id": string | null;
          "lease_until": string | null;
          "next_attempt_at": string;
          "owner_id": string | null;
          "state": string;
          "stream_uid": string;
        }[];
        SetofOptions: {
          from: "*";
          to: "stream_deletion_queue";
          isOneToOne: false;
          isSetofReturn: true;
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
      "claim_push_deliveries": {
        Args: { "p_limit"?: number };
        Returns: {
          "attempts": number;
          "id": string;
          "last_error": string | null;
          "lease_id": string | null;
          "lease_until": string | null;
          "next_attempt_at": string;
          "notice_id": string;
          "state": string;
          "submitted_at": string | null;
          "ticket_id": string | null;
          "token_id": string;
        }[];
        SetofOptions: {
          from: "*";
          to: "push_deliveries";
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
      "finish_account_deletion": {
        Args: {
          "p_complete": boolean;
          "p_error"?: string;
          "p_id": string;
          "p_lease": string;
        };
        Returns: undefined;
      };
      "finish_media_deletion": {
        Args: { "p_error"?: string; "p_lease": string; "p_uid": string };
        Returns: undefined;
      };
      "finish_meta_event": {
        Args: { "p_error"?: string; "p_id": string; "p_lease": string };
        Returns: undefined;
      };
      "finish_push_delivery": {
        Args: {
          "p_disable"?: boolean;
          "p_error"?: string;
          "p_id": string;
          "p_lease": string;
          "p_state": string;
          "p_ticket"?: string;
        };
        Returns: undefined;
      };
      "has_active_subscription": {
        Args: { "p_user_id": string };
        Returns: boolean;
      };
      "invite_channel_member": {
        Args: { "p_channel_id": string; "p_user_id": string };
        Returns: undefined;
      };
      "is_admin": { Args: Record<PropertyKey, never>; Returns: boolean };
      "is_erased_purchase_token": {
        Args: { "p_token": string };
        Returns: boolean;
      };
      "join_channel": { Args: { "p_channel_id": string }; Returns: undefined };
      "leave_channel": { Args: { "p_channel_id": string }; Returns: undefined };
      "mark_notice_read": {
        Args: { "p_notice_id": string };
        Returns: undefined;
      };
      "moderate_content": {
        Args: {
          "p_action": string;
          "p_id": string;
          "p_kind": string;
          "p_reason"?: string;
          "p_visibility"?: string;
        };
        Returns: undefined;
      };
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
      "playback_grant": {
        Args: { "p_title_id": string; "p_user_id": string };
        Returns: {
          "countries": (string)[];
          "duration_seconds": number;
          "expires_at": string;
          "stream_uid": string;
        }[];
      };
      "prepare_account_erasure": {
        Args: {
          "p_lease": string;
          "p_request_id": string;
          "p_user_id": string;
        };
        Returns: undefined;
      };
      "prune_operational_records": {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      "publisher_allowed": {
        Args: { "p_channel_id": string; "p_user_id": string };
        Returns: boolean;
      };
      "register_push_token": {
        Args: { "p_installation_id": string; "p_token": string };
        Returns: undefined;
      };
      "release_subscription_sync": {
        Args: { "p_lease": string; "p_token": string };
        Returns: undefined;
      };
      "reopen_title": { Args: { "p_title_id": string }; Returns: undefined };
      "report_title": {
        Args: {
          "p_details"?: string;
          "p_reason": string;
          "p_title_id": string;
        };
        Returns: string;
      };
      "request_account_deletion": {
        Args: { "p_session_id": string; "p_user_id": string };
        Returns: string;
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
      "reserve_stream_upload": {
        Args: { "p_title_id": string; "p_user_id": string };
        Returns: {
          "created_at": string;
          "duration_seconds": number | null;
          "error_code": string | null;
          "id": string;
          "lease_id": string | null;
          "lease_until": string | null;
          "next_check_at": string;
          "owner_id": string;
          "signed_only": boolean;
          "state": string;
          "stream_uid": string | null;
          "title_id": string;
          "updated_at": string;
          "upload_expires_at": string | null;
          "upload_url": string | null;
        };
        SetofOptions: {
          from: "*";
          to: "stream_assets";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "reset_stream_upload": {
        Args: { "p_title_id": string };
        Returns: undefined;
      };
      "resolve_play_owner": {
        Args: { "p_account_id": string; "p_linked_token": string };
        Returns: string;
      };
      "save_season": {
        Args: { "p_name": string; "p_number": number; "p_series_id": string };
        Returns: {
          "created_at": string;
          "id": string;
          "name": string;
          "number": number;
          "series_id": string;
        };
        SetofOptions: {
          from: "*";
          to: "seasons";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "save_title": {
        Args: {
          "p_channel_id": string;
          "p_countries"?: (string)[];
          "p_cover_url"?: string;
          "p_description": string;
          "p_episode_number"?: number;
          "p_kind": string;
          "p_min_age": number;
          "p_name": string;
          "p_season_id"?: string;
          "p_title_id"?: string;
        };
        Returns: {
          "allowed_countries": (string)[];
          "channel_id": string;
          "cover_url": string | null;
          "created_at": string;
          "description": string;
          "episode_number": number | null;
          "id": string;
          "kind": string;
          "min_age": number;
          "name": string;
          "owner_id": string;
          "published_at": string | null;
          "season_id": string | null;
          "status": string;
          "updated_at": string;
        };
        SetofOptions: {
          from: "*";
          to: "titles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "save_watch_progress": {
        Args: { "p_position_seconds": number; "p_title_id": string };
        Returns: {
          "completed": boolean;
          "position_seconds": number;
          "title_id": string;
          "updated_at": string;
          "user_id": string;
        };
        SetofOptions: {
          from: "*";
          to: "watch_progress";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "send_notice": {
        Args: {
          "p_body": string;
          "p_campaign_id": string;
          "p_data"?: Json;
          "p_title": string;
          "p_user_ids": (string)[];
        };
        Returns: number;
      };
      "set_saved_title": {
        Args: { "p_saved": boolean; "p_title_id": string };
        Returns: undefined;
      };
      "submit_channel": {
        Args: {
          "p_category"?: string;
          "p_cover_url"?: string;
          "p_description": string;
          "p_name": string;
        };
        Returns: {
          "category": string;
          "cover_url": string | null;
          "created_at": string;
          "created_by": string | null;
          "description": string | null;
          "id": string;
          "is_private": boolean;
          "name": string;
          "requires_subscription": boolean;
          "status": string;
          "updated_at": string;
        };
        SetofOptions: {
          from: "*";
          to: "channels";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      "submit_title_review": {
        Args: { "p_title_id": string };
        Returns: undefined;
      };
      "unregister_push_token": {
        Args: { "p_installation_id": string };
        Returns: undefined;
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
