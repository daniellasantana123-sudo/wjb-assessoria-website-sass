/**
 * Tipos manuais espelhando `supabase/migrations/0001_core_schema.sql`, no
 * mesmo formato que `supabase gen types typescript` gera de verdade.
 * Provisório: quando o projeto Supabase real existir, gerar com
 * `npx supabase gen types typescript --project-id <id> > src/types/database.ts`
 * e este arquivo deixa de ser mantido à mão.
 */

export type TenantMemberRole = "owner" | "member";
export type StaffRole = "super_admin" | "contador" | "atendimento";
export type ObligationStatus = "pending" | "done";
/** Sistemas dos quais uma obrigação pode vir espelhada (migration 0020). */
export type ExternalObligationSource = "omie_gclick";
export type DocumentCategory = "documento" | "guia";
/** 7 etapas do funil comercial desde a migration 0023 (2026-11-09). */
export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal_sent"
  | "negotiation"
  | "won"
  | "lost";
export type TicketStatus = "open" | "in_progress" | "closed";
export type AccountStatus = "active" | "suspended";
export type FeatureFlagKey = "omie_gclick" | "documents" | "notifications";
export type OmieIntegrationStatus =
  | "not_connected"
  | "pending"
  | "connected"
  | "syncing"
  | "synced"
  | "conflict"
  | "error"
  | "disabled";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string;
          is_wjb_staff: boolean;
          staff_role: StaffRole | null;
          status: AccountStatus;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email: string;
          is_wjb_staff?: boolean;
          staff_role?: StaffRole | null;
          status?: AccountStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      tenants: {
        Row: {
          id: string;
          name: string;
          cnpj: string | null;
          status: AccountStatus;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          cnpj?: string | null;
          status?: AccountStatus;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tenants"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "tenants_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_members: {
        Row: {
          id: string;
          tenant_id: string;
          profile_id: string;
          role: TenantMemberRole;
          status: AccountStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          profile_id: string;
          role?: TenantMemberRole;
          status?: AccountStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tenant_members"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          tenant_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          tenant_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_log_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          id: string;
          tenant_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string | null;
          size_bytes: number | null;
          uploaded_by: string | null;
          created_at: string;
          category: DocumentCategory;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          storage_path: string;
          file_name: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
          category?: DocumentCategory;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "documents_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      obligations: {
        Row: {
          id: string;
          tenant_id: string;
          title: string;
          description: string | null;
          due_date: string;
          status: ObligationStatus;
          created_by: string | null;
          created_at: string;
          /* 0020 — origem externa; nulo = lançada à mão pela WJB. */
          external_id: string | null;
          external_source: ExternalObligationSource | null;
          external_synced_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          title: string;
          description?: string | null;
          due_date: string;
          status?: ObligationStatus;
          created_by?: string | null;
          created_at?: string;
          external_id?: string | null;
          external_source?: ExternalObligationSource | null;
          external_synced_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["obligations"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "obligations_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obligations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      fiscal_requests: {
        Row: {
          id: string;
          tenant_id: string;
          document_type: string;
          status: string;
          idempotency_key: string;
          draft_snapshot: Record<string, unknown>;
          draft_hash: string;
          policy_decision: string | null;
          policy_reasons: string[];
          channel: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          attempt_count: number;
          next_attempt_at: string | null;
          last_error: string | null;
          needs_intervention: boolean;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          document_type?: string;
          status?: string;
          idempotency_key: string;
          draft_snapshot: Record<string, unknown>;
          draft_hash: string;
          policy_decision?: string | null;
          policy_reasons?: string[];
          channel?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          attempt_count?: number;
          next_attempt_at?: string | null;
          last_error?: string | null;
          needs_intervention?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["fiscal_requests"]["Insert"]>;
        Relationships: [];
      };
      fiscal_request_events: {
        Row: {
          id: number;
          request_id: string;
          tenant_id: string;
          from_status: string | null;
          to_status: string;
          actor_id: string | null;
          actor_kind: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          request_id: string;
          tenant_id: string;
          from_status?: string | null;
          to_status: string;
          actor_id?: string | null;
          actor_kind?: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["fiscal_request_events"]["Insert"]>;
        Relationships: [];
      };
      fiscal_issuance_attempts: {
        Row: {
          id: string;
          request_id: string;
          tenant_id: string;
          environment: string;
          idempotency_key: string;
          outcome: string;
          official_reference: string | null;
          rejection_code: string | null;
          simulated: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          tenant_id: string;
          environment: string;
          idempotency_key: string;
          outcome: string;
          official_reference?: string | null;
          rejection_code?: string | null;
          simulated: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["fiscal_issuance_attempts"]["Insert"]>;
        Relationships: [];
      };
      fiscal_profile_approver_grants: {
        Row: {
          id: string;
          profile_id: string;
          tenant_id: string | null;
          reason: string;
          granted_by: string;
          granted_at: string;
          revoked_at: string | null;
          revoked_by: string | null;
          revoke_reason: string | null;
        };
        Insert: { id?: string; profile_id: string; tenant_id?: string | null; reason: string; granted_by: string };
        Update: Partial<Database["public"]["Tables"]["fiscal_profile_approver_grants"]["Insert"]>;
        Relationships: [];
      };
      fiscal_profile_approvals: {
        Row: {
          id: string;
          fiscal_profile_id: string;
          tenant_id: string;
          profile_version: number;
          approved_by: string;
          approved_at: string;
          justification: string;
        };
        Insert: { id?: string; fiscal_profile_id: string; tenant_id: string; profile_version: number; approved_by: string; justification: string };
        Update: Partial<Database["public"]["Tables"]["fiscal_profile_approvals"]["Insert"]>;
        Relationships: [];
      };
      fiscal_profiles: {
        Row: {
          id: string;
          tenant_id: string;
          version: number;
          status: string;
          municipality_ibge_code: string | null;
          service_settings: Record<string, unknown>;
          max_amount_cents_without_review: number;
          approved_by: string | null;
          approved_at: string | null;
          approval_justification: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          version?: number;
          status?: string;
          municipality_ibge_code?: string | null;
          service_settings?: Record<string, unknown>;
          max_amount_cents_without_review?: number;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["fiscal_profiles"]["Insert"]>;
        Relationships: [];
      };
      fiscal_authorization_grants: {
        Row: {
          id: string;
          tenant_id: string;
          kind: string;
          scope: string;
          status: string;
          valid_until: string;
          evidence_reference: string | null;
          certificate_vault_reference: string | null;
          registered_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          kind: string;
          scope: string;
          status?: string;
          valid_until: string;
          evidence_reference?: string | null;
          certificate_vault_reference?: string | null;
          registered_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["fiscal_authorization_grants"]["Insert"]>;
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          name: string | null;
          email: string;
          phone: string | null;
          company: string | null;
          cnpj: string | null;
          city: string | null;
          state: string | null;
          business_activity: string | null;
          service_interest: string | null;
          message: string | null;
          form_context: string;
          source_path: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          status: LeadStatus;
          created_at: string;
          submission_id: string | null;
          landing_page: string | null;
          utm_term: string | null;
          utm_content: string | null;
          gclid: string | null;
          assigned_to: string | null;
          next_step: string | null;
          status_changed_at: string | null;
        };
        Insert: {
          id?: string;
          name?: string | null;
          email: string;
          phone?: string | null;
          company?: string | null;
          cnpj?: string | null;
          city?: string | null;
          state?: string | null;
          business_activity?: string | null;
          service_interest?: string | null;
          message?: string | null;
          form_context: string;
          source_path?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          status?: LeadStatus;
          created_at?: string;
          submission_id?: string | null;
          landing_page?: string | null;
          utm_term?: string | null;
          utm_content?: string | null;
          gclid?: string | null;
          assigned_to?: string | null;
          next_step?: string | null;
          status_changed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: [];
      };
      tickets: {
        Row: {
          id: string;
          tenant_id: string;
          subject: string;
          status: TicketStatus;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          subject: string;
          status?: TicketStatus;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tickets"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "tickets_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ticket_messages: {
        Row: {
          id: string;
          ticket_id: string;
          tenant_id: string;
          author_id: string | null;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          tenant_id: string;
          author_id?: string | null;
          body: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ticket_messages"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_messages_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_messages_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          tenant_id: string;
          author_id: string | null;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          author_id?: string | null;
          body: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "messages_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          tenant_id: string | null;
          type: string;
          title: string;
          body: string;
          link: string;
          metadata_sanitized: Record<string, unknown> | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          tenant_id?: string | null;
          type: string;
          title?: string;
          body: string;
          link: string;
          metadata_sanitized?: Record<string, unknown> | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      omie_client_mappings: {
        Row: {
          id: string;
          tenant_id: string;
          external_client_id: string | null;
          external_portal_url: string | null;
          status: OmieIntegrationStatus;
          last_synced_at: string | null;
          last_error: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          external_client_id?: string | null;
          external_portal_url?: string | null;
          status?: OmieIntegrationStatus;
          last_synced_at?: string | null;
          last_error?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["omie_client_mappings"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "omie_client_mappings_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "omie_client_mappings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      feature_flags: {
        Row: {
          key: string;
          enabled: boolean;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          enabled?: boolean;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["feature_flags"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "feature_flags_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      can_approve_fiscal_profile: { Args: { check_tenant_id: string }; Returns: boolean };
      grant_fiscal_profile_approver: {
        Args: { p_profile_id: string; p_tenant_id: string | null; p_reason: string };
        Returns: string;
      };
      revoke_fiscal_profile_approver: { Args: { p_grant_id: string; p_reason: string }; Returns: undefined };
      approve_fiscal_profile: { Args: { p_fiscal_profile_id: string; p_justification: string }; Returns: undefined };
    };
    Enums: {
      tenant_member_role: TenantMemberRole;
      staff_role: StaffRole;
      obligation_status: ObligationStatus;
      lead_status: LeadStatus;
      ticket_status: TicketStatus;
      account_status: AccountStatus;
      omie_integration_status: OmieIntegrationStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
